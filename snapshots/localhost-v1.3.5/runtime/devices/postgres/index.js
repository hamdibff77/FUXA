'use strict';

const { Pool } = require('pg');
const deviceUtils = require('../device-utils');

const quoteIdentifier = (identifier) => `"${String(identifier).replace(/"/g, '""')}"`;
const encodeAddress = (parts) => parts.map((part) => encodeURIComponent(part)).join('|');
const decodeAddress = (address) => String(address).split('|').map((part) => decodeURIComponent(part));
const MAX_DISTINCT_OPTIONS = 1000;

function PostgreSQLClient(_data, _logger, _events, _runtime) {
    let data = JSON.parse(JSON.stringify(_data));
    const logger = _logger;
    const events = _events;
    const runtime = _runtime;
    const pools = new Map();
    const varsValue = {};
    const warnedObjectDaqTags = new Set();
    let connected = false;
    let working = false;
    let lastTimestampValue = 0;
    let getProperty = null;
    this.addDaq = null;

    const getSecurity = async () => {
        if (!getProperty) {
            throw new Error('PostgreSQL credentials are unavailable');
        }
        const result = await getProperty({ query: 'security', name: data.id });
        if (!result || !result.value) {
            return {};
        }
        try {
            return JSON.parse(result.value);
        } catch (err) {
            throw new Error(`Invalid PostgreSQL credentials: ${err.message}`);
        }
    };

    const getPool = async (database) => {
        let pool = pools.get(database);
        if (pool) {
            return pool;
        }
        const security = await getSecurity();
        if (!security.uid) {
            throw new Error('PostgreSQL username is required');
        }
        pool = new Pool({
            host: data.property.address,
            port: Number(data.property && data.property.port) || 5432,
            user: security.uid,
            password: security.pwd,
            database,
            max: 2,
            idleTimeoutMillis: 30000
        });
        pool.on('error', (err) => logger.error(`'${data.name}' PostgreSQL pool error: ${err.message}`));
        pools.set(database, pool);
        return pool;
    };

    this.init = function () {};

    this.connect = async function () {
        if (!data.enabled) {
            connected = false;
            throw new Error('PostgreSQL device is disabled');
        }
        if (!data.property || !data.property.address) {
            connected = false;
            throw new Error('PostgreSQL host is required');
        }
        try {
            await (await getPool('postgres')).query('SELECT 1');
            connected = true;
            lastTimestampValue = Date.now();
            events.emit('device-status:changed', { id: data.id, status: 'connect-ok' });
        } catch (err) {
            connected = false;
            events.emit('device-status:changed', { id: data.id, status: 'connect-error' });
            throw err;
        }
    };

    this.disconnect = async function () {
        connected = false;
        const activePools = Array.from(pools.values());
        pools.clear();
        await Promise.all(activePools.map((pool) => pool.end()));
        events.emit('device-status:changed', { id: data.id, status: 'connect-off' });
        return true;
    };

    this.isConnected = () => connected;
    this.getStatus = () => connected ? 'connect-ok' : 'connect-error';
    this.lastReadTimestamp = () => lastTimestampValue;
    this.bindAddDaq = (fnc) => { this.addDaq = fnc; };
    this.bindGetProperty = (fnc) => { getProperty = fnc; };
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        const tagIds = new Set(Object.keys(data.tags || {}));
        for (const id of Object.keys(varsValue)) {
            if (!tagIds.has(id)) {
                delete varsValue[id];
            }
        }
    };
    this.getValue = (id) => varsValue[id];
    this.getValues = () => Object.values(varsValue);
    this.getTagProperty = (id) => data.tags && data.tags[id];
    this.setValue = async function () { return false; };
    this.getDistinctValuesForTag = async function (tagId) {
        const tag = data.tags && data.tags[tagId];
        if (!tag || typeof tag.address !== 'string') {
            throw new Error('PostgreSQL option source tag was not found');
        }

        let parts;
        try {
            parts = decodeAddress(tag.address);
        } catch (err) {
            throw new Error(`Invalid PostgreSQL option source address: ${err.message}`);
        }
        if (parts.length !== 4 || parts.some((part) => !part)) {
            throw new Error('Invalid PostgreSQL option source address');
        }

        const [database, schema, table, column] = parts;
        const quotedColumn = quoteIdentifier(column);
        const result = await (await getPool(database)).query(
            `SELECT DISTINCT ${quotedColumn} AS value
             FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}
             WHERE ${quotedColumn} IS NOT NULL
             ORDER BY ${quotedColumn}
             LIMIT $1`,
            [MAX_DISTINCT_OPTIONS + 1]
        );
        if (result.rows.length > MAX_DISTINCT_OPTIONS) {
            throw new Error(`PostgreSQL option source returned more than ${MAX_DISTINCT_OPTIONS} distinct values`);
        }

        return result.rows.map((row) => {
            const value = row.value;
            return value !== null && typeof value === 'object'
                ? (JSON.stringify(value) || String(value))
                : String(value);
        });
    };

    this.browse = async function (node) {
        const parts = node && node.id ? decodeAddress(node.id) : [];
        if (parts.length === 0) {
            const result = await (await getPool('postgres')).query(
                'SELECT datname FROM pg_database WHERE datistemplate = false AND datallowconn = true ORDER BY datname'
            );
            return result.rows.map((row) => ({
                id: encodeAddress([row.datname]),
                name: row.datname,
                class: 'Object'
            }));
        }
        if (parts.length === 1) {
            const database = parts[0];
            const result = await (await getPool(database)).query(
                `SELECT table_schema, table_name
                 FROM information_schema.tables
                 WHERE table_type = 'BASE TABLE'
                   AND table_schema NOT IN ('pg_catalog', 'information_schema')
                 ORDER BY table_schema, table_name`
            );
            return result.rows.map((row) => ({
                id: encodeAddress([database, row.table_schema, row.table_name]),
                name: `${row.table_schema}.${row.table_name}`,
                class: 'Object',
                type: 'object'
            }));
        }
        if (parts.length === 3) {
            const [database, schema, table] = parts;
            const result = await (await getPool(database)).query(
                `SELECT column_name, data_type
                 FROM information_schema.columns
                 WHERE table_schema = $1 AND table_name = $2
                 ORDER BY ordinal_position`,
                [schema, table]
            );
            return result.rows.map((row) => ({
                id: encodeAddress([database, schema, table, row.column_name]),
                name: row.column_name,
                class: 'Variable',
                type: /^(smallint|integer|bigint|numeric|decimal|real|double precision|boolean)$/.test(row.data_type)
                    ? (row.data_type === 'boolean' ? 'boolean' : 'number')
                    : 'string'
            }));
        }
        if (parts.length === 4) {
            return [];
        }
        throw new Error('Invalid PostgreSQL browse path');
    };

    this.polling = async function () {
        if (!connected || working) {
            return;
        }
        working = true;
        let successfulReads = 0;
        const toDaq = {};
        try {
            for (const id of Object.keys(data.tags || {})) {
                const tag = data.tags[id];
                let parts;
                try {
                    parts = decodeAddress(tag.address);
                } catch (err) {
                    logger.error(`'${data.name}' invalid PostgreSQL tag address for ${id}: ${err.message}`);
                    continue;
                }
                if (parts.length !== 3 && parts.length !== 4) {
                    logger.error(`'${data.name}' invalid PostgreSQL tag address for ${id}`);
                    continue;
                }
                const [database, schema, table, column] = parts;
                const isObjectTag = parts.length === 3;
                const orderBy = data.property && data.property.orderBy;
                const orderClause = orderBy ? ` ORDER BY ${quoteIdentifier(orderBy)} DESC` : '';
                try {
                    const result = await (await getPool(database)).query(
                        `SELECT ${isObjectTag ? '*' : `${quoteIdentifier(column)} AS value`} FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}${orderClause} LIMIT 1`
                    );
                    successfulReads++;
                    const rawValue = result.rows.length
                        ? (isObjectTag ? result.rows[0] : result.rows[0].value)
                        : null;
                    const previous = varsValue[id];
                    const value = rawValue === null || isObjectTag
                        ? rawValue
                        : deviceUtils.parseValue(rawValue, tag.type);
                    const composedValue = isObjectTag
                        ? value
                        : await deviceUtils.tagValueCompose(value, previous ? previous.value : null, tag, runtime);
                    const changed = !previous || (isObjectTag
                        ? JSON.stringify(previous.value) !== JSON.stringify(composedValue)
                        : previous.value !== composedValue);
                    const current = {
                        id,
                        rawValue,
                        value: composedValue,
                        type: tag.type,
                        daq: tag.daq,
                        changed,
                        timestamp: Date.now()
                    };
                    varsValue[id] = current;
                    if (this.addDaq && isObjectTag && tag.daq && (tag.daq.enabled || tag.daq.restored)) {
                        if (!warnedObjectDaqTags.has(id)) {
                            logger.error(`'${data.name}' PostgreSQL object tag ${id} cannot be stored in DAQ`);
                            warnedObjectDaqTags.add(id);
                        }
                    } else if (this.addDaq && deviceUtils.tagDaqToSave(current, current.timestamp)) {
                        toDaq[id] = current;
                    }
                } catch (err) {
                    const address = column ? `${schema}.${table}.${column}` : `${schema}.${table}`;
                    logger.error(`'${data.name}' PostgreSQL read failed for ${address}: ${err.message}`);
                }
            }
            if (successfulReads > 0 || !Object.keys(data.tags || {}).length) {
                lastTimestampValue = Date.now();
            }
            if (Object.keys(toDaq).length) {
                this.addDaq(toDaq);
            }
            if (Object.keys(varsValue).length) {
                events.emit('device-value:changed', { id: data.id, values: varsValue });
            }
        } catch (err) {
            logger.error(`'${data.name}' PostgreSQL polling failed: ${err.message}`);
        } finally {
            working = false;
        }
    };
}

module.exports = {
    init: function () {},
    create: function (data, logger, events, runtime) {
        return new PostgreSQLClient(data, logger, events, runtime);
    }
};
