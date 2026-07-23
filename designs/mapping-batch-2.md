# Mapping Batch 2 of 8

| Term (`@id`) | File | Current `equivalent` | Proposed SKOS Mappings | Confidence | Rationale | QC Status | JSON-LD Updated? |
|---|---|---|---|---|---|---|---|
| `dppk:certificationEndDate` | `core/Compliance.jsonld` | `None` | `skos:closeMatch schema:expires` | High | Schema.org expires is the closest match for an end date. | [REVIEWED] | [DONE] |
| `dppk:certificationId` | `core/Compliance.jsonld` | `schema:identifier` | `skos:relatedMatch schema:identifier` | High | Schema.org is general, so relatedMatch is appropriate. | [REVIEWED] | [DONE] |
| `dppk:certificationName` | `core/Compliance.jsonld` | `schema:name` | `skos:relatedMatch schema:name` | High | Schema.org name is a generic broader property. | [REVIEWED] | [DONE] |
| `dppk:certifications` | `core/Compliance.jsonld` | `schema:hasCertification<br>gs1:certification` | `skos:exactMatch schema:hasCertification<br>skos:exactMatch gs1:certification` | High | Both vocabs directly represent this relation. | [REVIEWED] | [DONE] |
| `dppk:certificationStartDate` | `core/Compliance.jsonld` | `gs1:certificationStartDate` | `skos:exactMatch gs1:certificationStartDate` | High | Exact property exists in GS1. | [REVIEWED] | [DONE] |
| `dppk:certificationUrl` | `core/Compliance.jsonld` | `schema:url` | `skos:relatedMatch schema:url` | High | URL is a generic property applicable here. | [REVIEWED] | [DONE] |
| `dppk:certifiedUsableEnergy` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery DPP concept. | [REVIEWED] | [DONE] |
| `dppk:characteristicName` | `core/Product.jsonld` | `gs1:characteristicName<br>schema:name` | `skos:exactMatch gs1:characteristicName<br>skos:closeMatch schema:name` | High | GS1 is exact, schema.org is slightly broader. | [REVIEWED] | [DONE] |
| `dppk:characteristicValue` | `core/Product.jsonld` | `gs1:characteristicValue<br>schema:value` | `skos:exactMatch gs1:characteristicValue<br>skos:closeMatch schema:value` | High | GS1 is exact, schema.org is close. | [REVIEWED] | [DONE] |
| `dppk:color` | `core/Product.jsonld` | `schema:color<br>gs1:colourDescription<br>unece:colourDescription` | `skos:exactMatch schema:color<br>skos:exactMatch gs1:colourDescription<br>skos:exactMatch unece:colourDescription` | High | Exact matches across all three major vocabularies. | [REVIEWED] | [DONE] |
| `dppk:Component` | `core/Product.jsonld` | `None` | `skos:closeMatch schema:Product` | Medium | Schema.org models components as products. | [REVIEWED] | [DONE] |
| `dppk:componentCasNumber` | `core/Product.jsonld` | `None` | `None` | High | CAS numbers for components are highly specific. | [REVIEWED] | [DONE] |
| `dppk:componentEcNumber` | `core/Product.jsonld` | `None` | `None` | High | EC numbers for components are highly specific. | [REVIEWED] | [DONE] |
| `dppk:componentIdentifier` | `core/Product.jsonld` | `None` | `skos:relatedMatch schema:identifier` | High | Maps generically to an identifier. | [REVIEWED] | [DONE] |
| `dppk:componentIupacName` | `core/Product.jsonld` | `None` | `None` | High | IUPAC name for components is highly specific. | [REVIEWED] | [DONE] |
| `dppk:componentLocationInProduct` | `core/Product.jsonld` | `None` | `None` | High | Specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:componentName` | `core/Product.jsonld` | `None` | `skos:relatedMatch schema:name` | High | Maps generically to schema.org name. | [REVIEWED] | [DONE] |
| `dppk:componentPercentage` | `core/Product.jsonld` | `None` | `skos:relatedMatch schema:value` | Low | Can be represented as a generic value. | [REVIEWED] | [DONE] |
| `dppk:components` | `core/Product.jsonld` | `None` | `skos:closeMatch schema:hasPart` | High | Schema.org hasPart is used to link parts to wholes. | [REVIEWED] | [DONE] |
| `dppk:compressiveStrength` | `sectors/Construction.jsonld` | `None` | `None` | High | Specialized property for construction sector. | [REVIEWED] | [DONE] |
| `dppk:ConstructionProduct` | `sectors/Construction.jsonld` | `None` | `skos:closeMatch schema:Product` | High | Represents a product in schema.org. | [REVIEWED] | [DONE] |
| `dppk:contentSpecificationIds` | `core/Header.jsonld` | `None` | `None` | High | Internal DPP header field. | [REVIEWED] | [DONE] |
| `dppk:contentType` | `core/RelatedResource.jsonld` | `schema:encodingFormat` | `skos:exactMatch schema:encodingFormat` | High | Exactly aligns with encodingFormat semantics. | [REVIEWED] | [DONE] |
| `dppk:countryOfOrigin` | `core/Product.jsonld` | `schema:countryOfOrigin<br>gs1:countryOfOrigin<br>unece:originCountry` | `skos:exactMatch schema:countryOfOrigin<br>skos:exactMatch gs1:countryOfOrigin<br>skos:exactMatch unece:originCountry` | High | Exact conceptual alignment across all vocabularies. | [REVIEWED] | [DONE] |
| `dppk:cRateCycleTest` | `sectors/Battery.jsonld` | `None` | `None` | High | Specialized battery test metric. | [REVIEWED] | [DONE] |
| `dppk:criticalRawMaterials` | `sectors/Battery.jsonld` | `None` | `None` | High | Specialized regulatory concept. | [REVIEWED] | [DONE] |
| `dppk:cupSize` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `skos:closeMatch schema:size` | Medium | Schema.org size covers apparel sizes broadly. | [REVIEWED] | [DONE] |
| `dppk:cycleCountFull` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized battery cycle metric. | [REVIEWED] | [DONE] |
| `dppk:depth` | `core/Product.jsonld` | `schema:depth` | `skos:exactMatch schema:depth` | High | Directly aligns with schema.org depth. | [REVIEWED] | [DONE] |
| `dppk:description` | `core/Product.jsonld` | `schema:description<br>gs1:productDescription<br>unece:description` | `skos:exactMatch schema:description<br>skos:exactMatch gs1:productDescription<br>skos:exactMatch unece:description` | High | Exact match across all standards. | [REVIEWED] | [DONE] |
| `dppk:DigitalProductPassport` | `core/Header.jsonld` | `None` | `skos:closeMatch schema:Product<br>skos:closeMatch schema:Certification<br>skos:closeMatch unece:Document` | Medium | Inherits traits from Product, Certification, and Document. | [REVIEWED] | [DONE] |
| `dppk:digitalProductPassportId` | `core/Header.jsonld` | `None` | `skos:relatedMatch schema:identifier` | High | Maps to a generic identifier in schema.org. | [REVIEWED] | [DONE] |
| `dppk:dimensionalChange` | `sectors/Textile.jsonld` | `None` | `None` | High | Textile-specific dimensional property. | [REVIEWED] | [DONE] |
| `dppk:dimensionName` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `skos:relatedMatch schema:name` | High | Maps to generic name. | [REVIEWED] | [DONE] |
| `dppk:dimensionValue` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `skos:relatedMatch schema:value` | High | Maps to generic value. | [REVIEWED] | [DONE] |
| `dppk:disassemblyInstructions` | `sectors/Electronics.jsonld` | `None` | `skos:closeMatch schema:howTo` | Medium | Instructions can be modeled as schema:HowTo. | [REVIEWED] | [DONE] |
| `dppk:dismantlingInformation` | `sectors/Battery.jsonld` | `None` | `None` | High | Specific regulatory requirement for batteries. | [REVIEWED] | [DONE] |
| `dppk:documents` | `core/Compliance.jsonld` | `gs1:referencedFile` | `skos:closeMatch gs1:referencedFile<br>skos:relatedMatch schema:subjectOf` | High | GS1 is close, schema is related. | [REVIEWED] | [DONE] |
| `dppk:dopc` | `core/DoPC.jsonld` | `None` | `skos:relatedMatch schema:hasCertification` | High | A declaration block conceptually functions like a certification. | [REVIEWED] | [DONE] |
| `dppk:DoPCBlock` | `core/DoPC.jsonld` | `schema:Certification` | `skos:closeMatch schema:Certification` | High | Declarations functionally serve as certifications. | [REVIEWED] | [DONE] |
| `dppk:dppSchemaVersion` | `core/Header.jsonld` | `None` | `None` | High | Internal DPP metadata field. | [REVIEWED] | [DONE] |
| `dppk:dppStatus` | `core/Header.jsonld` | `None` | `None` | High | Internal DPP metadata field. | [REVIEWED] | [DONE] |
| `dppk:dueDiligenceReport` | `sectors/Battery.jsonld` | `None` | `None` | High | Specific regulatory report. | [REVIEWED] | [DONE] |
| `dppk:economicOperator` | `core/Organization.jsonld` | `None` | `skos:closeMatch schema:Organization` | Medium | Economic operator is an organization. | [REVIEWED] | [DONE] |
| `dppk:economicOperatorId` | `core/Header.jsonld` | `None` | `skos:relatedMatch schema:identifier` | High | Maps generically to an identifier. | [REVIEWED] | [DONE] |
| `dppk:EconomicOperatorRole` | `core/Compliance.jsonld` | `None` | `skos:closeMatch schema:Role` | High | Maps to schema:Role pattern. | [REVIEWED] | [DONE] |
| `dppk:efficiency` | `sectors/Battery.jsonld` | `None` | `None` | High | Sector-specific battery efficiency. | [REVIEWED] | [DONE] |
| `dppk:EfficiencyInfo` | `sectors/Battery.jsonld` | `None` | `None` | High | Sector-specific struct. | [REVIEWED] | [DONE] |
| `dppk:ElectronicDevice` | `sectors/Electronics.jsonld` | `None` | `skos:closeMatch schema:Product` | Medium | Specialized product class. | [REVIEWED] | [DONE] |
| `dppk:email` | `core/Organization.jsonld` | `schema:email<br>gs1:email` | `skos:exactMatch schema:email<br>skos:exactMatch gs1:email` | High | Exact alignment with major standards. | [REVIEWED] | [DONE] |
