'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const sinon = require('sinon');
const { Pool } = require('pg');
const PostgreSQL = require('../runtime/devices/postgres');

describe('PostgreSQL device', function () {
    let queryStub;
    let endStub;
    let queries;

    beforeEach(function () {
        queries = [];
        queryStub = sinon.stub(Pool.prototype, 'query').callsFake(async (query, params) => {
            queries.push({ query, params });
            if (query === 'SELECT 1') {
                return { rows: [] };
            }
            if (query.includes('FROM pg_database')) {
                return { rows: [{ datname: 'telemetry' }] };
            }
            if (query.includes('FROM information_schema.tables')) {
                return { rows: [{ table_schema: 'public', table_name: 'sensor"data' }] };
            }
            if (query.includes('FROM information_schema.columns')) {
                return { rows: [{ column_name: 'temperature', data_type: 'double precision' }] };
            }
            if (query.includes('FROM "public"."sensor""data"')) {
                return { rows: [{ value: 21.5 }] };
            }
            throw new Error(`Unexpected query: ${query}`);
        });
        endStub = sinon.stub(Pool.prototype, 'end').resolves();
    });

    afterEach(function () {
        sinon.restore();
    });

    it('browses databases, tables, columns and polls a quoted read-only tag', async function () {
        const events = new EventEmitter();
        const device = {
            id: 'postgres-device',
            name: 'PostgreSQL',
            type: 'PostgreSQL',
            enabled: true,
            property: { address: '127.0.0.1', port: 5432, orderBy: 'created_at' },
            tags: {}
        };
        const client = PostgreSQL.create(device, { error() {} }, events, {});
        client.bindGetProperty(async () => ({
            value: JSON.stringify({ uid: 'reader', pwd: 'secret' })
        }));

        await client.connect();
        const databases = await client.browse(null);
        assert.deepStrictEqual(databases.map((node) => node.name), ['telemetry']);

        const tables = await client.browse({ id: databases[0].id });
        assert.strictEqual(tables[0].name, 'public.sensor"data');

        const columns = await client.browse({ id: tables[0].id });
        assert.strictEqual(columns[0].name, 'temperature');
        assert.strictEqual(columns[0].type, 'number');

        device.tags.temperature = {
            id: 'temperature',
            address: columns[0].id,
            type: columns[0].type
        };
        client.load(device);
        let changedValues;
        events.on('device-value:changed', (message) => { changedValues = message.values; });
        await client.polling();

        assert.strictEqual(changedValues.temperature.value, 21.5);
        const valueQuery = queries.find((entry) => entry.query.includes('FROM "public"."sensor""data"'));
        assert(valueQuery);
        assert(valueQuery.query.includes('ORDER BY "created_at" DESC'));
        assert(valueQuery.query.includes('LIMIT 1'));
        await client.disconnect();
        assert(endStub.called);
    });
});
