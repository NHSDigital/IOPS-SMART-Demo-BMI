import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {client} from "fhirclient";
import Client from "fhirclient/lib/Client";
import {
    Bundle,
    Observation,
    Parameters,
    Patient,
    QuestionnaireResponse,
    ValueSet,
    ValueSetExpansionContains
} from "fhir/r4";
import {fhirclient} from "fhirclient/lib/types";
import {HttpClient} from "@angular/common/http";
import { DatePipe } from '@angular/common';
// @ts-ignore
import {v4 as uuidv4} from 'uuid';

@Component({
  selector: 'app-bmi',
  templateUrl: './bmi.component.html',
  styleUrls: ['./bmi.component.scss']
})
export class BMIComponent implements OnInit {
    bmi: string='';

    patient : Patient | undefined;
    ethnicCategories: ValueSetExpansionContains[] | undefined;
    ethnicCategory :ValueSetExpansionContains | undefined
    administrativeGenders: ValueSetExpansionContains[] | undefined;
    administrativeGender :ValueSetExpansionContains | undefined
    epr: string | undefined

    ctx : Client | undefined  = undefined

    markdown = `This is a mock to demonstrate the launch of application via [SMART Launch](https://www.hl7.org/fhir/smart-app-launch/)

It is based on [BMI healthy weight calculator](https://www.nhs.uk/live-well/healthy-weight/bmi-calculator/)`
    height: number | undefined;
    age: number| undefined;
    weight: number | undefined;
    waist: number | undefined;
    waistratio: string | undefined;

    constructor(private route: ActivatedRoute,
                private http: HttpClient) { }

    calculate() {

        var bundle : Bundle = {
            entry: [], type: "transaction",
            resourceType: 'Bundle'
        }
        if (this.weight !== undefined && this.height !== undefined) {
            var calc = this.weight / ((this.height/100) * (this.height/100))
            console.log(calc)
            this.bmi='Your BMI is '+calc.toFixed(1) + ' A BMI calculation in the healthy weight range is between 18.5 to 24.9.'
            var observation: Observation = {
                code: {
                    coding: [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "60621009",
                            "display": "Body mass index"
                        }
                    ]
                }, resourceType: "Observation", status:"final"
            }
            observation.subject = {
                "reference": "Patient/"+this.patient?.id
            }
            observation.effectiveDateTime =this.getFHIRDateString(new Date())
            observation.valueQuantity = {
              value: calc,
                code: 'kg/m2'
            }
            bundle.entry?.push({
                "fullUrl": "urn:uuid:" + uuidv4(),
                "resource": observation,
                "request": {
                    url: "Observation",
                    method: "POST"
                }
            })
            console.log(bundle)
        }
        if (this.height !== undefined && this.waist !== undefined) {
            var calc = this.waist / this.height
            console.log(calc)
            this.waistratio = 'Waist to height ratio '+calc.toFixed(2) + ' A waist to height ratio of 0.5 or higher means you may have increased health risks such as heart disease, type 2 diabetes and stroke.'
        }
        // @ts-ignore
        if (bundle.entry?.length > 0 && this.epr !== undefined ) {
            this.http.post(this.epr + '/', bundle).subscribe(result => {
                console.log(result)
            })
        }

    }

    ngOnInit(): void {
        this.route.queryParams
            .subscribe(params => {
                    console.log(params);
                    console.log(params['iss']);
                    console.log(params['patient']);
                    if (params['iss'] !== undefined) {

                        this.epr = params['iss']
                        this.ctx = client({
                            serverUrl: params['iss']
                        });
                        if (params['patient'] !== undefined) {
                            this.ctx.request("Patient/" + params['patient']).then(result => {
                                console.log(result)
                                if (result.resourceType==='Patient') {
                                    this.patient = result
                                    if (this.patient?.birthDate !== undefined) {
                                        let timeDiff = Math.abs(Date.now() - Date.parse(this.patient.birthDate));
                                        let age = Math.floor((timeDiff / (1000 * 3600 * 24)) / 365.25);
                                        this.age= age
                                    }
                                    this.setSelectAnswers()
                                }

                            })
                            var parameters : Parameters = {
                                "resourceType" : "Parameters",

                                "parameter" : [
                                    {
                                        "name": "subject",
                                        "valueReference": {
                                            "reference": "Patient/" + params['patient']
                                        }
                                    },
                                    {
                                        "name": "questionnaireRef",
                                        "valueReference": {
                                            "reference": "Questionnaire/b1132517-9aea-4968-910b-ccfa3889c33a"
                                        }
                                    }
                                ]
                            }

                            // @ts-ignore
                            this.http.post(params['iss'] + '/Questionnaire/$populate', parameters).subscribe(result => {
                                console.log(result)
                                if (result !== undefined) {

                                    var parameters = result as Parameters
                                    if (parameters.parameter !== undefined) {

                                        for (var parameter of parameters.parameter) {
                                            if (parameter.name === 'response') {

                                                var questionnaireResponse = parameter.resource as QuestionnaireResponse
                                                if (questionnaireResponse.item !== undefined) {

                                                    for (var item of questionnaireResponse.item) {
                                                        if ( item.linkId === '9832470915833') {
                                                            // @ts-ignore
                                                            this.height = item.answer[0].valueQuantity.value
                                                        }

                                                        if ( item.linkId === '81247982689') {
                                                            // @ts-ignore
                                                            this.weight = item.answer[0].valueQuantity.value
                                                        }
                                                        if ( item.linkId === '7761181498456') {
                                                            // @ts-ignore
                                                            this.waist = item.answer[0].valueQuantity.value
                                                        }
                                                        if ( item.linkId === '7658017405403' && this.ethnicCategories !== undefined) {
                                                            for (var ethnic of this.ethnicCategories) {

                                                                // @ts-ignore
                                                                if (item.answer[0].valueCoding.code === ethnic.code) {
                                                                    this.ethnicCategory = ethnic
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            })
                            this.http.get(params['iss'] + '/ValueSet/$expand?url=https://fhir.hl7.org.uk/ValueSet/UKCore-EthnicCategory').subscribe(result => {
                                console.log(result)
                                this.ethnicCategories = this.getContainsExpansion(result)
                                this.setSelectAnswers()
                            })
                            this.http.get(params['iss'] + '/ValueSet/$expand?url=http://hl7.org/fhir/ValueSet/administrative-gender').subscribe(result => {
                                console.log(result)
                                this.administrativeGenders = this.getContainsExpansion(result)
                                this.setSelectAnswers()
                            })
                        }
                    }
                }
            );
    }
    getContainsExpansion(resource: any): ValueSetExpansionContains[] {
        const valueSet = resource as ValueSet;
        const contains: ValueSetExpansionContains[] = [];
        if (valueSet !== undefined && valueSet.expansion !== undefined && valueSet.expansion.contains !== undefined) {
            for (const concept of valueSet.expansion.contains) {
                contains.push(concept);
            }
        }
        return contains;
    }

    setSelectAnswers() {
        if (this.patient !== undefined) {
            if (this.administrativeGenders !== undefined) {
                for (var gender of this.administrativeGenders) {

                    if (gender.code === this.patient.gender) {
                        this.administrativeGender = gender
                    }
                }
            }
            if (this.ethnicCategories !== undefined) {

            }
        }
    }
    getFHIRDateString(date : Date) : string {
        var datePipe = new DatePipe('en-GB');
        //2023-05-12T13:22:31.964Z
        var utc = datePipe.transform(date, 'yyyy-MM-ddTHH:mm:ss.SSSZZZZZ');
        if (utc!= null) return utc
        return date.toISOString()
    }
}
