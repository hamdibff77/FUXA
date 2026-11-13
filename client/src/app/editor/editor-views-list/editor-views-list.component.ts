import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { View, ViewType } from '../../_models/hmi';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { MatDialog as MatDialog } from '@angular/material/dialog';
import { ProjectService } from '../../_services/project.service';
import { ViewPropertyComponent, ViewPropertyType } from '../view-property/view-property.component';
import * as FileSaver from 'file-saver';
import { EditNameComponent, EditNameData } from '../../gui-helpers/edit-name/edit-name.component';
import { Device, DeviceType, Tag } from '../../_models/device';
import { HmiService } from '../../_services/hmi.service';
import { interval, Subject, takeUntil } from 'rxjs';
import { DevicePropertyComponent } from '../../device/device-property/device-property.component';

@Component({
    selector: 'app-editor-views-list',
    templateUrl: './editor-views-list.component.html',
    styleUrls: ['./editor-views-list.component.scss']
})
export class EditorViewsListComponent implements OnInit, OnChanges, OnDestroy {

    @Input() views: View[] = [];
    @Input('select') set select(view: View) {
        this.currentView = view;
    };
    @Output() selected: EventEmitter<View> = new EventEmitter<View>();
    @Output() viewPropertyChanged: EventEmitter<View> = new EventEmitter<View>();
    @Output() cloneView: EventEmitter<View> = new EventEmitter<View>();

    currentView: View = null;
    connections: Device[] = [];
    expandedConnections: { [id: string]: boolean } = {};
    private connectionStatuses: { [id: string]: { status: string; last: number } } = {};
    private destroy$ = new Subject<void>();

    cardViewType = ViewType.cards;
    svgViewType = ViewType.svg;
    mapsViewType = ViewType.maps;

    constructor(private projectService: ProjectService,
        private translateService: TranslateService,
        private hmiService: HmiService,
        public dialog: MatDialog,
    ) { }

    ngOnInit() {
        this.refreshConnections();
        this.hmiService.onDeviceChanged.pipe(
            takeUntil(this.destroy$)
        ).subscribe((event: any) => {
            if (event?.id && event?.status) {
                this.connectionStatuses[event.id] = { status: event.status, last: Date.now() };
            }
        });
        interval(10000).pipe(
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.refreshConnections();
            this.hmiService.askDeviceStatus();
        });
        this.hmiService.askDeviceStatus();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.views) {
            this.refreshConnections();
        }
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private refreshConnections() {
        this.connections = this.projectService.getServerDevices().filter(
            device => device.type !== DeviceType.FuxaServer
        );
        this.connections.forEach(device => {
            if (this.expandedConnections[device.id] === undefined) {
                this.expandedConnections[device.id] = true;
            }
        });
    }

    getConnectionTags(device: Device): Tag[] {
        return Object.values(device.tags || {}).sort((left, right) =>
            (left.label || left.name || '').localeCompare(right.label || right.name || '')
        );
    }

    toggleConnectionTags(device: Device, event: Event) {
        event.stopPropagation();
        this.expandedConnections[device.id] = !this.expandedConnections[device.id];
    }

    getConnectionStatus(device: Device): string {
        if (device.enabled === false) {
            return 'connect-off';
        }
        const status = this.connectionStatuses[device.id];
        if (!status) {
            return '';
        }
        if (status.last + 15000 < Date.now() && status.status !== 'connect-off') {
            return 'connect-error';
        }
        return status.status;
    }

    getConnectionStatusColor(device: Device): string {
        const status = this.getConnectionStatus(device);
        if (status === 'connect-ok') {
            return '#00b050';
        }
        if (status === 'connect-error' || status === 'connect-failed') {
            return '#ff2d2d';
        }
        if (status === 'connect-off' || status === 'connect-busy') {
            return '#ffc000';
        }
        return '#9e9e9e';
    }

    getConnectionAddress(device: Device): string {
        const address = device.property?.address;
        if (typeof address !== 'string' || !address.trim()) {
            return '-';
        }
        const trimmedAddress = address.trim();
        if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmedAddress)) {
            try {
                const url = new URL(trimmedAddress);
                return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
            } catch (error) {
                console.warn(`Unable to parse connection address for ${device.name}`, error);
            }
        }
        return trimmedAddress.replace(
            /((?:password|pwd|token|secret|username|user|uid)\s*=\s*)("[^"]*"|'[^']*'|[^;\s]*)/gi,
            '$1[redacted]'
        );
    }

    onConfigureConnection(device: Device) {
        const availableType = [device.type];
        const exist = this.projectService.getDeviceList()
            .filter(existing => existing.id !== device.id)
            .map(existing => existing.name);
        const editableDevice: Device = JSON.parse(JSON.stringify(device));
        const dialogRef = this.dialog.open(DevicePropertyComponent, {
            disableClose: true,
            panelClass: 'dialog-property',
            width: '450px',
            maxWidth: 'calc(100vw - 32px)',
            data: {
                device: editableDevice,
                remove: false,
                exist,
                availableType,
                projectService: this.projectService
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.device) {
                const oldDevice: Device = JSON.parse(JSON.stringify(device));
                this.projectService.setDevice(result.device, oldDevice, result.security);
                this.refreshConnections();
                this.hmiService.askDeviceStatus();
            }
        });
    }

    onSelectView(view: View, force = true) {
        if (!force && this.currentView?.id === view?.id) {
            return;
        }
        this.currentView = view;
        this.selected.emit(this.currentView);
    }

    getViewsSorted() {
        return this.views.sort((a, b) => {
            if (a.name > b.name) { return 1; }
            return -1;
        });
    }

    isViewActive(view) {
        return (this.currentView && this.currentView.name === view.name);
    }

    onDeleteView(view) {
        let msg = '';
        this.translateService.get('msg.view-remove', { value: view.name }).subscribe((txt: string) => { msg = txt; });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            position: { top: '60px' },
            data: <ConfirmDialogData> { msg: this.translateService.instant('msg.view-remove', { value: view.name }) }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && this.views) {
                let toselect = null;
                for (var i = 0; i < this.views.length; i++) {
                    if (this.views[i].id === view.id) {
                        this.views.splice(i, 1);
                        if (i > 0 && i < this.views.length) {
                            toselect = this.views[i];
                        }
                        break;
                    }
                }
                this.currentView = null;
                if (toselect) {
                    this.onSelectView(toselect);
                } else if (this.views.length > 0) {
                    this.onSelectView(this.views[0]);
                }
                this.projectService.removeView(view);
            }
        });
    }

    onRenameView(view) {
        let exist = this.views.filter((v) => v.id !== view.id).map((v) => v.name);
        let dialogRef = this.dialog.open(EditNameComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <EditNameData> {
                title: this.translateService.instant('dlg.docname-title'),
                name: view.name,
                exist: exist
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name) {
                view.name = result.name;
                this.projectService.setView(view, false);
            }
        });
    }

    onPropertyView(view) {
        let dialogRef = this.dialog.open(ViewPropertyComponent, {
            position: { top: '60px' },
            disableClose: true,
            data: <ViewPropertyType> {
                name: view.name,
                type: view.type || ViewType.svg,
                profile: view.profile,
                property: view.property}
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.profile) {
                if (result.profile.height) {view.profile.height = parseInt(result.profile.height);}
                if (result.profile.width) {view.profile.width = parseInt(result.profile.width);}
                if (result.profile.margin >= 0) {view.profile.margin = parseInt(result.profile.margin);}
                view.profile.bkcolor = result.profile.bkcolor;
                if (result.property?.events) {
                    view.property ??= { events: [], actions: [] };
                    view.property.events = result.property.events;
                }
                this.viewPropertyChanged.emit(view);
                this.onSelectView(view);
            }
        });
    }

    onCloneView(view: View) {
        this.cloneView.emit(view);
    }

    onExportView(view: View) {
        let filename = `${view.name}.json`;
        let content = JSON.stringify(view);
        let blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        FileSaver.saveAs(blob, filename);
    }

    onCleanView(view: View) {
       const changed = this.projectService.cleanView(view);
       if (changed) {
            this.onSelectView(view);
       }
    }
}
