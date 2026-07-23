# Mapping Batch 6 of 8

| Term (`@id`) | File | Current `equivalent` | Proposed SKOS Mappings | Confidence | Rationale | QC Status | JSON-LD Updated? |
|---|---|---|---|---|---|---|---|
| `dppk:productionLocationCountry` | `sectors/Textile.jsonld` | `None` | `skos:exactMatch gs1:countryOfOrigin`<br>`skos:exactMatch schema:countryOfOrigin` | High | Both directly model the country of origin/production. | [REVIEWED] | [DONE] |
| `dppk:ProductionStep` | `core/Compliance.jsonld` | `None` | `skos:relatedMatch schema:Action` | Low | No exact match; Action models a generic step. | [REVIEWED] | [DONE] |
| `dppk:ProductionStep` | `sectors/Textile.jsonld` | `None` | `skos:relatedMatch schema:Action` | Low | No exact match; Action models a generic step. | [REVIEWED] | [DONE] |
| `dppk:productionSteps` | `core/Compliance.jsonld` | `None` | `skos:relatedMatch schema:step` | Low | Schema.org 'step' represents a step in a process. | [REVIEWED] | [DONE] |
| `dppk:productionSteps` | `sectors/Textile.jsonld` | `None` | `skos:relatedMatch schema:step` | Low | Schema.org 'step' represents a step in a process. | [REVIEWED] | [DONE] |
| `dppk:productionStepType` | `core/Compliance.jsonld` | `None` | `None` | High | Highly specialized internal concept. | [REVIEWED] | [DONE] |
| `dppk:productionStepType` | `sectors/Textile.jsonld` | `None` | `None` | High | Highly specialized internal concept. | [REVIEWED] | [DONE] |
| `dppk:productName` | `core/Product.jsonld` | `gs1:productName<br>unece:name` | `skos:exactMatch gs1:productName`<br>`skos:exactMatch schema:name`<br>`skos:exactMatch unece:name` | High | Direct alignment on the name of the product. | [REVIEWED] | [DONE] |
| `dppk:productNumber` | `sectors/IronSteel.jsonld` | `schema:productID<br>schema:model<br>gs1:globalModelNumber` | `skos:closeMatch schema:productID`<br>`skos:closeMatch gs1:globalModelNumber` | High | Product number generally aligns with identifiers like productID. | [REVIEWED] | [DONE] |
| `dppk:Public` | `core/Visibility.jsonld` | `None` | `None` | High | Internal visibility enumeration; no direct vocabulary match. | [REVIEWED] | [DONE] |
| `dppk:purchaserOrder` | `sectors/IronSteel.jsonld` | `schema:orderNumber` | `skos:exactMatch schema:orderNumber` | High | Matches standard purchase order properties. | [REVIEWED] | [DONE] |
| `dppk:QuantitativeValue` | `core/Product.jsonld` | `schema:QuantitativeValue<br>qudt:QuantityValue<br>unece:QuantityType` | `skos:exactMatch schema:QuantitativeValue`<br>`skos:exactMatch unece:QuantityType` | High | Core datatype for values with units. | [REVIEWED] | [DONE] |
| `dppk:railProfile` | `sectors/Construction.jsonld` | `None` | `None` | High | Highly specialized construction domain concept. | [REVIEWED] | [DONE] |
| `dppk:ratedCapacity` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery parameter. | [REVIEWED] | [DONE] |
| `dppk:ratedPower` | `sectors/Electronics.jsonld` | `None` | `None` | High | Highly specialized electronics parameter. | [REVIEWED] | [DONE] |
| `dppk:reachDocumentation` | `sectors/IronSteel.jsonld` | `None` | `None` | High | Specific regulatory document type. | [REVIEWED] | [DONE] |
| `dppk:recyclabilityScore` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific sustainability or rating concept. | [REVIEWED] | [DONE] |
| `dppk:recycledContentConformity` | `sectors/IronSteel.jsonld` | `None` | `None` | High | Specific regulatory/conformity concept. | [REVIEWED] | [DONE] |
| `dppk:recycledContentPercentage` | `core/Product.jsonld` | `None` | `None` | High | Specialized sustainability parameter without direct match. | [REVIEWED] | [DONE] |
| `dppk:recycledContentPercentage` | `sectors/IronSteel.jsonld` | `None` | `None` | High | Specialized sustainability parameter without direct match. | [REVIEWED] | [DONE] |
| `dppk:referenceTestCycleLife` | `sectors/Battery.jsonld` | `None` | `None` | High | Specialized battery test parameter. | [REVIEWED] | [DONE] |
| `dppk:RelatedResource` | `core/RelatedResource.jsonld` | `schema:DigitalDocument<br>gs1:Document` | `skos:closeMatch schema:DigitalDocument`<br>`skos:closeMatch gs1:Document` | High | Closely aligns with generic document concepts. | [REVIEWED] | [DONE] |
| `dppk:remainingCapacity` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery parameter. | [REVIEWED] | [DONE] |
| `dppk:remainingUsableEnergy` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery parameter. | [REVIEWED] | [DONE] |
| `dppk:renewableContent` | `sectors/Battery.jsonld` | `None` | `None` | High | Specialized sustainability concept. | [REVIEWED] | [DONE] |
| `dppk:repairInstructions` | `core/RelatedResource.jsonld` | `None` | `None` | High | Specialized resource type. | [REVIEWED] | [DONE] |
| `dppk:repairService` | `core/Organization.jsonld` | `None` | `skos:relatedMatch schema:Service` | Medium | Closely relates to generic schema Service. | [REVIEWED] | [DONE] |
| `dppk:resourceTitle` | `core/RelatedResource.jsonld` | `None` | `skos:exactMatch schema:headline`<br>`skos:exactMatch schema:name` | Medium | Title of a resource maps well to schema:headline or name. | [REVIEWED] | [DONE] |
| `dppk:robustnessScore` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific rating concept. | [REVIEWED] | [DONE] |
| `dppk:roundTripEfficiencyAt50Cycles` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery parameter. | [REVIEWED] | [DONE] |
| `dppk:roundTripEfficiencyFade` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery parameter. | [REVIEWED] | [DONE] |
| `dppk:roundTripEfficiencyInitial` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery parameter. | [REVIEWED] | [DONE] |
| `dppk:roundTripEfficiencyRemaining` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery parameter. | [REVIEWED] | [DONE] |
| `dppk:safetyDataSheet` | `core/RelatedResource.jsonld` | `None` | `None` | High | Specific regulatory document type. | [REVIEWED] | [DONE] |
| `dppk:safetyMeasures` | `sectors/Battery.jsonld` | `None` | `None` | High | Specific safety concept. | [REVIEWED] | [DONE] |
| `dppk:safeUseInstructions` | `core/RelatedResource.jsonld` | `None` | `None` | High | Specific document/resource type. | [REVIEWED] | [DONE] |
| `dppk:secondaryDimensions` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Highly specialized size system parameter. | [REVIEWED] | [DONE] |
| `dppk:selfDischargeCurrent` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery parameter. | [REVIEWED] | [DONE] |
| `dppk:selfDischargeEvolution` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery parameter. | [REVIEWED] | [DONE] |
| `dppk:selfDischargeInitial` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery parameter. | [REVIEWED] | [DONE] |
| `dppk:separateCollectionSymbol` | `sectors/Battery.jsonld` | `None` | `None` | High | Specific regulatory symbol. | [REVIEWED] | [DONE] |
| `dppk:serviceDate` | `sectors/Battery.jsonld` | `None` | `None` | High | Specific operational date for batteries. | [REVIEWED] | [DONE] |
| `dppk:serviceManualAvailable` | `sectors/Electronics.jsonld` | `None` | `None` | High | Specific availability flag. | [REVIEWED] | [DONE] |
| `dppk:sizeDesignation` | `sectors/EUApparelSizeSystem.jsonld` | `gs1:sizeCode` | `skos:exactMatch gs1:sizeCode`<br>`skos:exactMatch schema:size` | High | Matches standard size code properties. | [REVIEWED] | [DONE] |
| `dppk:soce` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery metric (State of Charge). | [REVIEWED] | [DONE] |
| `dppk:softwareUpdatePolicy` | `sectors/Electronics.jsonld` | `None` | `None` | High | Specialized policy property. | [REVIEWED] | [DONE] |
| `dppk:sourceDocument` | `core/MTC.jsonld` | `None` | `None` | High | Internal document reference. | [REVIEWED] | [DONE] |
| `dppk:sparePartsAvailable` | `sectors/Electronics.jsonld` | `None` | `None` | High | Specialized availability flag. | [REVIEWED] | [DONE] |
| `dppk:sparePartsSources` | `sectors/Battery.jsonld` | `None` | `None` | High | Specialized battery concept. | [REVIEWED] | [DONE] |
| `dppk:spirality` | `sectors/Textile.jsonld` | `None` | `None` | High | Specialized textile parameter. | [REVIEWED] | [DONE] |
