import { Component, Input, OnInit } from '@angular/core';
import { WidgetProperty } from '../../../_models/hmi';
import { ProjectService } from '../../../_services/project.service';
import { SvgUtils } from '../../../_helpers/svg-utils';
import { PropertyType } from '../flex-input/flex-input.component';

@Component({
    selector: 'flex-widget-property',
    templateUrl: './flex-widget-property.component.html',
    styleUrls: ['./flex-widget-property.component.scss']
})
export class FlexWidgetPropertyComponent implements OnInit {

    @Input() property: WidgetProperty;
    @Input() data: any;
    rangePropertyType = PropertyType.range;

    constructor(private projectService: ProjectService) {
    }

    ngOnInit() {
        this.data = this.data || { devices: Object.values(this.projectService.getDevices()) };
        this.property.symbolAppearance = this.property.symbolAppearance || {};
        // Populate defaults from SVG script if available
        if (this.property?.varsToBind?.length && this.property?.scriptContent?.content) {
            this.property.varsToBind = SvgUtils.populateDefaults(
                this.property.scriptContent.content,
                this.property.varsToBind
            );
        }
    }
}
