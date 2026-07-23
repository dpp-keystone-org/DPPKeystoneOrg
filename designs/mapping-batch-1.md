# Mapping Batch 1 of 8

| Term (`@id`) | File | Current `equivalent` | Proposed SKOS Mappings | Confidence | Rationale | QC Status | JSON-LD Updated? |
|---|---|---|---|---|---|---|---|
| `dppk:additionalCertification` | `core/Compliance.jsonld` | `None` | `None` | Medium | Subproperty of general certifications, maps to general certification relations in external schemas. | [CORRECTED] | [DONE] |
| `dppk:additionalOrganizationId` | `core/Organization.jsonld` | `gs1:additionalOrganizationIdentification` | `skos:exactMatch gs1:additionalOrganizationIdentification` | High | Exact property correspondence in GS1. | [REVIEWED] | [DONE] |
| `dppk:additionalOrganizationIdType` | `core/Organization.jsonld` | `gs1:additionalOrganizationIdentificationType` | `skos:exactMatch gs1:additionalOrganizationIdentificationType` | High | Exact property correspondence in GS1. | [REVIEWED] | [DONE] |
| `dppk:address` | `core/Organization.jsonld` | `schema:address<br>gs1:address<br>unece:postalAddress` | `skos:exactMatch schema:address<br>skos:exactMatch gs1:address<br>skos:exactMatch unece:postalAddress` | High | Exact property correspondence across standard ontologies. | [REVIEWED] | [DONE] |
| `dppk:addressCountry` | `core/Organization.jsonld` | `schema:addressCountry<br>gs1:addressCountry<br>unece:countryName` | `skos:exactMatch schema:addressCountry<br>skos:exactMatch gs1:addressCountry<br>skos:closeMatch unece:countryName` | High | Exact conceptual match to Schema/GS1 country, close match to UNECE country name. | [REVIEWED] | [DONE] |
| `dppk:addressLocality` | `core/Organization.jsonld` | `schema:addressLocality<br>gs1:addressLocality` | `skos:exactMatch schema:addressLocality<br>skos:exactMatch gs1:addressLocality` | High | Exact correspondence to locality/city in standard ontologies. | [REVIEWED] | [DONE] |
| `dppk:animalOriginNonTextile` | `sectors/Textile.jsonld` | `None` | `None` | High | Highly specialized EU regulatory concept with no exact match in general vocabularies. | [REVIEWED] | [DONE] |
| `dppk:apparelSize` | `core/Product.jsonld` | `gs1:sizeCode` | `skos:exactMatch schema:size<br>skos:exactMatch gs1:sizeCode` | High | Maps precisely to size concepts in Schema and GS1. | [REVIEWED] | [DONE] |
| `dppk:apparelSizeSystem` | `core/Product.jsonld` | `None` | `skos:exactMatch schema:sizeSystem` | High | Exact conceptual match to Schema.org sizeSystem. | [REVIEWED] | [DONE] |
| `dppk:AuthorityOnly` | `core/Visibility.jsonld` | `None` | `None` | High | Internal DPP visibility constraint, no equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:Batch` | `core/Header.jsonld` | `None` | `None` | High | Internal structural class, no direct equivalent. | [REVIEWED] | [DONE] |
| `dppk:batteryCategory` | `sectors/Battery.jsonld` | `None` | `None` | High | Battery regulation specific property without direct general ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:batteryChemistry` | `sectors/Battery.jsonld` | `None` | `None` | High | Battery regulation specific property without direct general ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:batteryMass` | `sectors/Battery.jsonld` | `None` | `None` | High | Battery regulation specific property without direct general ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:BatteryPerformance` | `sectors/Battery.jsonld` | `None` | `None` | High | Battery regulation specific property without direct general ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:BatteryProduct` | `sectors/Battery.jsonld` | `None` | `None` | High | Battery regulation specific property without direct general ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:batteryStatus` | `sectors/Battery.jsonld` | `None` | `None` | High | Battery regulation specific property without direct general ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:BodyDimArmLength` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:BodyDimBustGirth` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:BodyDimChestGirth` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:BodyDimensionValue` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:BodyDimFootLength` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:BodyDimHeight` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:BodyDimHipGirth` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:BodyDimInsideLegLength` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:BodyDimNeckGirth` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:BodyDimUnderbustGirth` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:BodyDimWaistGirth` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `None` | High | Specific EU apparel sizing dimension not in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:brand` | `core/Product.jsonld` | `schema:brand<br>gs1:brandName<br>unece:brandName` | `skos:exactMatch schema:brand<br>skos:exactMatch gs1:brandName<br>skos:exactMatch unece:brandName` | High | Exact property correspondence across standard ontologies. | [REVIEWED] | [DONE] |
| `dppk:capacity` | `sectors/Battery.jsonld` | `None` | `None` | High | Battery regulation specific property without direct general ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:capacityFade` | `sectors/Battery.jsonld` | `None` | `None` | High | Battery regulation specific property without direct general ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:CapacityInfo` | `sectors/Battery.jsonld` | `None` | `None` | High | Battery regulation specific property without direct general ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:capacityThroughput` | `sectors/Battery.jsonld` | `None` | `None` | High | Battery regulation specific property without direct general ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:carbonFootprint` | `sectors/Textile.jsonld` | `None` | `None` | High | No exact match in standard generic vocabularies for this specific footprint calculation. | [REVIEWED] | [DONE] |
| `dppk:carbonFootprintAbsolute` | `sectors/Battery.jsonld` | `None` | `None` | High | No exact match in standard generic vocabularies for this specific footprint calculation. | [REVIEWED] | [DONE] |
| `dppk:carbonFootprintBenchmarkPercentage` | `sectors/Textile.jsonld` | `None` | `None` | High | No exact match in standard generic vocabularies for this specific footprint calculation. | [REVIEWED] | [DONE] |
| `dppk:carbonFootprintCalculationParameters` | `sectors/Textile.jsonld` | `None` | `None` | High | No exact match in standard generic vocabularies for this specific footprint calculation. | [REVIEWED] | [DONE] |
| `dppk:carbonFootprintClass` | `sectors/Battery.jsonld` | `None` | `None` | High | No exact match in standard generic vocabularies for this specific footprint calculation. | [REVIEWED] | [DONE] |
| `dppk:carbonFootprintClass` | `sectors/Textile.jsonld` | `None` | `None` | High | No exact match in standard generic vocabularies for this specific footprint calculation. | [REVIEWED] | [DONE] |
| `dppk:carbonFootprintGeneralInfo` | `sectors/Battery.jsonld` | `None` | `None` | High | No exact match in standard generic vocabularies for this specific footprint calculation. | [REVIEWED] | [DONE] |
| `dppk:carbonFootprintLabel` | `sectors/Battery.jsonld` | `None` | `None` | High | No exact match in standard generic vocabularies for this specific footprint calculation. | [REVIEWED] | [DONE] |
| `dppk:carbonFootprintStudy` | `sectors/Battery.jsonld` | `None` | `None` | High | No exact match in standard generic vocabularies for this specific footprint calculation. | [REVIEWED] | [DONE] |
| `dppk:careInstructions` | `core/RelatedResource.jsonld` | `None` | `skos:exactMatch schema:careInstructions` | High | Exact match to Schema.org careInstructions. | [REVIEWED] | [DONE] |
| `dppk:castNumber` | `sectors/IronSteel.jsonld` | `gs1:batchLot` | `skos:relatedMatch gs1:batchLot` | Medium | Cast number is conceptually similar to a batch lot, though slightly more specific to metal production. | [REVIEWED] | [DONE] |
| `dppk:cbamReportId` | `sectors/IronSteel.jsonld` | `None` | `None` | High | CBAM report ID is highly specific to EU carbon border regulations. | [REVIEWED] | [DONE] |
| `dppk:Certification` | `core/Compliance.jsonld` | `schema:Certification<br>gs1:CertificationDetails<br>unece:certificationEvidenceDocument` | `skos:exactMatch schema:Certification<br>skos:exactMatch gs1:CertificationDetails<br>skos:exactMatch unece:certificationEvidenceDocument` | High | Exact class correspondence across standard ontologies. | [REVIEWED] | [DONE] |
| `dppk:certificationBodyId` | `core/Compliance.jsonld` | `None` | `None` | High | No direct standard generic equivalent for this specific ID. | [REVIEWED] | [DONE] |
| `dppk:certificationBodyName` | `core/Compliance.jsonld` | `gs1:certificationAgency` | `skos:exactMatch gs1:certificationAgency` | High | Exact property correspondence in GS1. | [REVIEWED] | [DONE] |
| `dppk:certificationBodyRole` | `core/Compliance.jsonld` | `None` | `None` | High | DPP-specific regulatory role classification. | [REVIEWED] | [DONE] |
| `dppk:CertificationBodyRoleType` | `core/Compliance.jsonld` | `None` | `None` | High | DPP-specific regulatory role classification. | [REVIEWED] | [DONE] |
