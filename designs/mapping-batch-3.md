# Mapping Batch 3 of 8

| Term (`@id`) | File | Current `equivalent` | Proposed SKOS Mappings | Confidence | Rationale | QC Status | JSON-LD Updated? |
|---|---|---|---|---|---|---|---|
| `dppk:endOfLifeInstructions` | `core/RelatedResource.jsonld` | `None` | skos:relatedMatch schema:HowTo | Low | Schema.org HowTo is a generic equivalent for instructions but lacks EOL specificity. | [REVIEWED] | [DONE] |
| `dppk:energyEfficiencyClass` | `sectors/Electronics.jsonld` | `None` | skos:exactMatch schema:hasEnergyEfficiencyCategory | High | Schema.org provides an exact match for energy efficiency categorization. | [REVIEWED] | [DONE] |
| `dppk:energyThroughput` | `sectors/Battery.jsonld` | `None` | None | High | Highly specialized battery concept with no plausible equivalent in generic external vocabularies. | [REVIEWED] | [DONE] |
| `dppk:environmentalFootprint` | `sectors/Textile.jsonld` | `None` | None | Low | Overruled: Footprint is a metric, not a certification. | [CORRECTED] | [DONE] |
| `dppk:environmentalFootprintBenchmarkPercentage` | `sectors/Textile.jsonld` | `None` | None | High | Highly specialized internal concept. | [REVIEWED] | [DONE] |
| `dppk:environmentalFootprintClass` | `sectors/Textile.jsonld` | `None` | None | High | Highly specialized internal concept. | [REVIEWED] | [DONE] |
| `dppk:eori` | `core/Organization.jsonld` | `None` | skos:relatedMatch schema:identifier | Medium | EORI is a specific identifier, best mapped loosely to a generic identifier property. | [REVIEWED] | [DONE] |
| `dppk:epd` | `core/EPDMetadata.jsonld` | `None` | skos:relatedMatch schema:Certification | Medium | EPD acts similarly to a certification or environmental credential. | [REVIEWED] | [DONE] |
| `dppk:EPDBlock` | `core/EPDMetadata.jsonld` | `schema:Certification` | skos:exactMatch schema:Certification | High | Explicitly designed to map directly to schema:Certification per the provided target. | [REVIEWED] | [DONE] |
| `dppk:euApparelSize` | `sectors/EUApparelSizeSystem.jsonld` | `None` | skos:closeMatch schema:size | High | Directly aligns with Schema.org size property. | [REVIEWED] | [DONE] |
| `dppk:EuApparelSizeObject` | `sectors/EUApparelSizeSystem.jsonld` | `None` | skos:closeMatch schema:SizeSpecification | High | Maps closely to the schema:SizeSpecification class structure. | [REVIEWED] | [DONE] |
| `dppk:euDeclarationOfConformity` | `sectors/Textile.jsonld` | `None` | skos:relatedMatch schema:Certification | Medium | Can be loosely modelled as a certification or credential in Schema.org. | [REVIEWED] | [DONE] |
| `dppk:euEcolabel` | `sectors/Textile.jsonld` | `None` | skos:relatedMatch schema:Certification | Medium | Represents a specific form of environmental certification. | [REVIEWED] | [DONE] |
| `dppk:europeanAssessmentDocument` | `sectors/Construction.jsonld` | `None` | skos:relatedMatch schema:Certification | Medium | An assessment document functions similarly to a generic certification. | [REVIEWED] | [DONE] |
| `dppk:eventsAccidents` | `sectors/Battery.jsonld` | `None` | None | High | Battery-specific event log with no external equivalent. | [REVIEWED] | [DONE] |
| `dppk:eventsDeepDischarge` | `sectors/Battery.jsonld` | `None` | None | High | Battery-specific event log with no external equivalent. | [REVIEWED] | [DONE] |
| `dppk:eventsOvercharge` | `sectors/Battery.jsonld` | `None` | None | High | Battery-specific event log with no external equivalent. | [REVIEWED] | [DONE] |
| `dppk:exhaustionCapacityThreshold` | `sectors/Battery.jsonld` | `None` | None | High | Battery-specific threshold metric. | [REVIEWED] | [DONE] |
| `dppk:expectedLifetimeCycles` | `sectors/Battery.jsonld` | `None` | None | High | Specialized battery life metric without external mapping. | [REVIEWED] | [DONE] |
| `dppk:expectedLifetimeYears` | `sectors/Battery.jsonld` | `None` | skos:relatedMatch schema:duration | Medium | Can be loosely associated with a duration measurement in Schema.org. | [REVIEWED] | [DONE] |
| `dppk:extinguishingAgent` | `sectors/Battery.jsonld` | `None` | None | High | Highly specialized safety property without generic equivalent. | [REVIEWED] | [DONE] |
| `dppk:facilityId` | `core/Header.jsonld` | `None` | skos:relatedMatch schema:identifier | Medium | A specialized identifier loosely mapping to the generic identifier property. | [REVIEWED] | [DONE] |
| `dppk:fibreComposition` | `sectors/Textile.jsonld` | `None` | skos:closeMatch schema:material | High | Schema.org material property is a close match for describing fabric composition. | [REVIEWED] | [DONE] |
| `dppk:gln` | `core/Organization.jsonld` | `gs1:globalLocationNumber<br>schema:globalLocationNumber<br>unece:gLNId` | skos:exactMatch gs1:globalLocationNumber<br>skos:exactMatch schema:globalLocationNumber<br>skos:exactMatch unece:gLNId | High | GLN maps exactly across all three ontologies. | [REVIEWED] | [DONE] |
| `dppk:governedBy` | `core/Header.jsonld` | `None` | skos:relatedMatch schema:sponsor | Low | Loose association to sponsorship or organizational control in Schema.org. | [REVIEWED] | [DONE] |
| `dppk:granularity` | `core/Header.jsonld` | `None` | None | High | Highly specialized DPP concept regarding data granularity. | [REVIEWED] | [DONE] |
| `dppk:GranularityValue` | `core/Header.jsonld` | `None` | None | High | Highly specialized DPP concept. | [REVIEWED] | [DONE] |
| `dppk:grossWeight` | `core/Product.jsonld` | `gs1:grossWeight<br>unece:grossWeightMeasure` | skos:exactMatch gs1:grossWeight<br>skos:exactMatch unece:grossWeightMeasure<br>skos:closeMatch schema:weight | High | Exact matches in GS1/UNECE and a close match in schema.org. | [REVIEWED] | [DONE] |
| `dppk:gtin` | `core/Product.jsonld` | `schema:gtin<br>gs1:gtin<br>unece:gTINId` | skos:exactMatch schema:gtin<br>skos:exactMatch gs1:gtin<br>skos:exactMatch unece:gTINId | High | GTIN is a universal standard with exact matches in all targets. | [REVIEWED] | [DONE] |
| `dppk:harmonisedStandardReference` | `sectors/Construction.jsonld` | `None` | skos:relatedMatch schema:Certification | Low | Can be loosely interpreted as pointing to a standard or certification. | [REVIEWED] | [DONE] |
| `dppk:hazardousSubstances` | `sectors/Battery.jsonld` | `None` | skos:relatedMatch schema:material | Low | Hazardous substances are a subset or characteristic of a product's material makeup. | [REVIEWED] | [DONE] |
| `dppk:hazardousSubstancesImpact` | `sectors/Battery.jsonld` | `None` | None | High | Specialized battery footprint parameter. | [REVIEWED] | [DONE] |
| `dppk:heatNumber` | `sectors/IronSteel.jsonld` | `gs1:batchLot<br>schema:sku` | skos:closeMatch gs1:batchLot<br>skos:relatedMatch schema:sku | Medium | Heat number serves a similar function to a batch or lot number. | [REVIEWED] | [DONE] |
| `dppk:heavyMetalSymbols` | `sectors/Battery.jsonld` | `None` | None | High | Specifically referring to battery labeling requirements. | [REVIEWED] | [DONE] |
| `dppk:height` | `core/Product.jsonld` | `schema:height` | skos:exactMatch schema:height<br>skos:exactMatch gs1:height<br>skos:exactMatch unece:heightMeasure | High | Standard height property universally matching across ontologies. | [REVIEWED] | [DONE] |
| `dppk:hsCode` | `core/Header.jsonld` | `gs1:customsClassification<br>schema:hscode` | skos:exactMatch schema:hscode<br>skos:closeMatch gs1:customsClassification | High | Hscode is identically represented in schema and closely in GS1. | [REVIEWED] | [DONE] |
| `dppk:identifier` | `core/Identifier.jsonld` | `schema:identifier` | skos:exactMatch schema:identifier | High | Standardized generic identifier mapping. | [REVIEWED] | [DONE] |
| `dppk:image` | `core/Product.jsonld` | `schema:image<br>gs1:productImage<br>unece:specifiedPicture` | skos:exactMatch schema:image<br>skos:exactMatch gs1:productImage<br>skos:exactMatch unece:specifiedPicture | High | Concept maps directly across all targets. | [REVIEWED] | [DONE] |
| `dppk:importer` | `core/Organization.jsonld` | `None` | skos:relatedMatch schema:merchant | Medium | Loosely maps to a merchant or commercial entity in generic schemas. | [REVIEWED] | [DONE] |
| `dppk:ImporterRole` | `core/Compliance.jsonld` | `None` | skos:closeMatch schema:OrganizationRole | High | An organizational role concept that fits schema:OrganizationRole. | [REVIEWED] | [DONE] |
| `dppk:instructionsForUse` | `core/RelatedResource.jsonld` | `None` | skos:relatedMatch schema:HowTo | Medium | Loosely aligns with instructions format in Schema.org. | [REVIEWED] | [DONE] |
| `dppk:internalResistance` | `sectors/Battery.jsonld` | `None` | None | High | Highly specialized battery physical parameter. | [REVIEWED] | [DONE] |
| `dppk:internalResistanceIncrease` | `sectors/Battery.jsonld` | `None` | None | High | Specialized battery degradation metric. | [REVIEWED] | [DONE] |
| `dppk:InternalResistanceInfo` | `sectors/Battery.jsonld` | `None` | None | High | Complex structural object specific to internal resistance context. | [REVIEWED] | [DONE] |
| `dppk:internalResistanceInitial` | `sectors/Battery.jsonld` | `None` | None | High | Specialized battery initial condition metric. | [REVIEWED] | [DONE] |
| `dppk:ipRating` | `sectors/Electronics.jsonld` | `None` | skos:relatedMatch schema:PropertyValue | Low | IP Rating is a specific property value with no direct equivalent. | [REVIEWED] | [DONE] |
| `dppk:IronSteelProduct` | `sectors/IronSteel.jsonld` | `None` | skos:closeMatch schema:Product | High | Subclass of product closely matching the parent class concept. | [REVIEWED] | [DONE] |
| `dppk:Item` | `core/Header.jsonld` | `None` | skos:exactMatch schema:IndividualProduct | High | Represents a specific physical item like schema:IndividualProduct. | [REVIEWED] | [DONE] |
| `dppk:KgWeightLiteral` | `core/Product.jsonld` | `None` | skos:closeMatch schema:QuantitativeValue | High | Maps closely to a defined quantitative payload. | [REVIEWED] | [DONE] |
| `dppk:labelMeaning` | `sectors/Battery.jsonld` | `None` | None | High | Uniquely specific text description field for a particular sector. | [REVIEWED] | [DONE] |
