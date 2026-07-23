# Mapping Batch 7 of 8

| Term (`@id`) | File | Current `equivalent` | Proposed SKOS Mappings | Confidence | Rationale | QC Status | JSON-LD Updated? |
|---|---|---|---|---|---|---|---|
| `dppk:stateOfCharge` | `sectors/Battery.jsonld` | `None` | None | High | Highly specialized battery metric not found in generic vocabularies. | [REVIEWED] | [DONE] |
| `dppk:steelDesignation` | `sectors/IronSteel.jsonld` | `None` | None | High | Sector-specific industrial term without broad ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:steelGrade` | `sectors/Construction.jsonld` | `None` | None | High | Sector-specific industrial classification without broad ontology equivalent. | [REVIEWED] | [DONE] |
| `dppk:steelGradeClassification` | `sectors/IronSteel.jsonld` | `None` | None | High | Sector-specific classification schema not found in broad vocabularies. | [REVIEWED] | [DONE] |
| `dppk:streetAddress` | `core/Organization.jsonld` | `schema:streetAddress<br>gs1:streetAddress` | `skos:exactMatch schema:streetAddress<br>skos:exactMatch gs1:streetAddress` | High | Standard address field equivalently defined in both major ontologies. | [REVIEWED] | [DONE] |
| `dppk:substancesOfConcern` | `core/Compliance.jsonld` | `None` | None | High | Specific regulatory compliance array not directly mapped to core e-commerce schemas. | [REVIEWED] | [DONE] |
| `dppk:supplyChainAssurances` | `sectors/Battery.jsonld` | `None` | None | High | Complex composite regulatory object lacking a direct parallel in standard web ontologies. | [REVIEWED] | [DONE] |
| `dppk:supplyChainIndices` | `sectors/Battery.jsonld` | `None` | None | High | Highly specific composite tracking metrics unique to DPP requirements. | [REVIEWED] | [DONE] |
| `dppk:technicalAssessmentBody` | `sectors/Construction.jsonld` | `None` | None | High | Specialized regulatory body role lacking direct equivalence in general schemas. | [REVIEWED] | [DONE] |
| `dppk:technologyRoute` | `sectors/IronSteel.jsonld` | `None` | None | High | Domain-specific industrial process property without broad vocabulary equivalent. | [REVIEWED] | [DONE] |
| `dppk:telephone` | `core/Organization.jsonld` | `schema:telephone<br>gs1:telephone` | `skos:exactMatch schema:telephone<br>skos:exactMatch gs1:telephone` | High | Standard contact information property universally defined. | [REVIEWED] | [DONE] |
| `dppk:temperature` | `sectors/Battery.jsonld` | `None` | None | High | Measured property usually represented as a generic PropertyValue in Schema.org rather than a specific term. | [REVIEWED] | [DONE] |
| `dppk:temperatureIdleLower` | `sectors/Battery.jsonld` | `None` | None | High | Highly specialized battery operational parameter. | [REVIEWED] | [DONE] |
| `dppk:temperatureIdleUpper` | `sectors/Battery.jsonld` | `None` | None | High | Highly specialized battery operational parameter. | [REVIEWED] | [DONE] |
| `dppk:TemperatureInfo` | `sectors/Battery.jsonld` | `None` | None | High | Sector-specific class for grouping temperature limits. | [REVIEWED] | [DONE] |
| `dppk:testMethod` | `core/Product.jsonld` | `gs1:measurementMethod<br>schema:measurementMethod` | `skos:closeMatch gs1:measurementMethod<br>skos:closeMatch schema:measurementMethod` | Medium | Both describe the procedure used, though nuances between test and measurement may exist. | [REVIEWED] | [DONE] |
| `dppk:testReports` | `sectors/Battery.jsonld` | `None` | None | High | Regulatory document array not represented in general-purpose product ontologies. | [REVIEWED] | [DONE] |
| `dppk:textileCareInstructions` | `sectors/Textile.jsonld` | `None` | None | High | Sector-specific property similar to generic instructions but explicitly textile-focused. | [REVIEWED] | [DONE] |
| `dppk:textileCertifications` | `sectors/Textile.jsonld` | `None` | None | High | Highly specific certification array for textiles not cleanly mapped to generic schemas. | [REVIEWED] | [DONE] |
| `dppk:textileEndOfLifeInstructions` | `sectors/Textile.jsonld` | `None` | None | High | Sector-specific end-of-life process instructions without broad equivalent. | [REVIEWED] | [DONE] |
| `dppk:TextileProduct` | `sectors/Textile.jsonld` | `None` | None | High | Sector-specific product class; mapped hierarchically internally but without direct external equivalent. | [REVIEWED] | [DONE] |
| `dppk:textileRepairInstructions` | `sectors/Textile.jsonld` | `None` | None | High | Sector-specific maintenance instructions lacking general schema parallel. | [REVIEWED] | [DONE] |
| `dppk:textileSafeUseInstructions` | `sectors/Textile.jsonld` | `None` | None | High | Sector-specific safety instructions without direct generic equivalent. | [REVIEWED] | [DONE] |
| `dppk:textileSubstancesOfConcern` | `sectors/Textile.jsonld` | `None` | None | High | Sector-specific regulatory compliance field without direct counterpart. | [REVIEWED] | [DONE] |
| `dppk:textileWeight` | `sectors/Textile.jsonld` | `None` | None | High | Sector-specific fabric weight property lacking general vocabulary parallel. | [REVIEWED] | [DONE] |
| `dppk:thermalConductivity` | `sectors/Construction.jsonld` | `None` | None | High | Specialized physical property not native to general e-commerce ontologies. | [REVIEWED] | [DONE] |
| `dppk:timeChargingTempLower` | `sectors/Battery.jsonld` | `None` | None | High | Specialized battery specification lacking general schema equivalent. | [REVIEWED] | [DONE] |
| `dppk:timeChargingTempUpper` | `sectors/Battery.jsonld` | `None` | None | High | Specialized battery specification lacking general schema equivalent. | [REVIEWED] | [DONE] |
| `dppk:timeExtremeTempLower` | `sectors/Battery.jsonld` | `None` | None | High | Specialized battery specification lacking general schema equivalent. | [REVIEWED] | [DONE] |
| `dppk:timeExtremeTempUpper` | `sectors/Battery.jsonld` | `None` | None | High | Specialized battery specification lacking general schema equivalent. | [REVIEWED] | [DONE] |
| `dppk:torque` | `sectors/Electronics.jsonld` | `None` | None | High | Specialized mechanical property not found in core GS1 or Schema.org vocabularies. | [REVIEWED] | [DONE] |
| `dppk:tradingName` | `core/Organization.jsonld` | `gs1:organizationTradingName<br>unece:tradingBusinessName` | `skos:exactMatch gs1:organizationTradingName<br>skos:exactMatch unece:tradingBusinessName` | High | Direct equivalents for an organization's trading or business name across standards. | [REVIEWED] | [DONE] |
| `dppk:uniqueProductIdentifier` | `core/Header.jsonld` | `gs1:productID<br>schema:productID` | `skos:exactMatch gs1:productID<br>skos:exactMatch schema:productID` | High | Direct equivalence for a universal product identifier. | [REVIEWED] | [DONE] |
| `dppk:unit` | `core/Header.jsonld` | `None` | None | High | Handled by generic QuantitativeValue or unitCode in other schemas. | [REVIEWED] | [DONE] |
| `dppk:Unit` | `core/Unit.jsonld` | `None` | None | High | Internal DPP-Keystone class for handling measurement units. | [REVIEWED] | [DONE] |
| `dppk:unitCode` | `core/Product.jsonld` | `schema:unitCode<br>gs1:unitCode<br>unece:QuantityTypeCode` | `skos:exactMatch schema:unitCode<br>skos:exactMatch gs1:unitCode<br>skos:exactMatch unece:QuantityTypeCode` | High | Universally used property across major standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:unitInherited` | `core/Header.jsonld` | `None` | None | High | Internal DPP-Keystone mechanism for inheriting units without external equivalent. | [REVIEWED] | [DONE] |
| `dppk:unitSymbol` | `core/Unit.jsonld` | `None` | None | High | Internal representation for unit symbols, usually handled via unitText in other schemas. | [REVIEWED] | [DONE] |
| `dppk:unitText` | `core/Product.jsonld` | `schema:unitText` | `skos:exactMatch schema:unitText` | High | Direct equivalence to Schema.org string representation of units. | [REVIEWED] | [DONE] |
| `dppk:url` | `core/RelatedResource.jsonld` | `schema:url` | `skos:exactMatch schema:url` | High | Universal standard property for web links. | [REVIEWED] | [DONE] |
| `dppk:validationReports` | `sectors/Construction.jsonld` | `None` | None | High | Sector-specific regulatory array for construction documents. | [REVIEWED] | [DONE] |
| `dppk:value` | `core/Product.jsonld` | `schema:value<br>gs1:value<br>unece:unitQuantity` | `skos:exactMatch schema:value<br>skos:exactMatch gs1:value<br>skos:closeMatch unece:unitQuantity` | Medium | Standard property for quantitative values, closely aligning across ontologies. | [REVIEWED] | [DONE] |
| `dppk:versionDate` | `core/Header.jsonld` | `None` | None | High | Highly specialized internal header field for tracking metadata dates. | [REVIEWED] | [DONE] |
| `dppk:versionNumber` | `core/Header.jsonld` | `None` | None | High | Internal versioning field, not cleanly mapping to a direct product-level version. | [REVIEWED] | [DONE] |
| `dppk:visibility` | `core/Visibility.jsonld` | `None` | None | High | Specialized DPP-Keystone access control property. | [REVIEWED] | [DONE] |
| `dppk:VisibilityValue` | `core/Visibility.jsonld` | `None` | None | High | Specialized DPP-Keystone access control enum class. | [REVIEWED] | [DONE] |
| `dppk:visualInspection` | `sectors/Textile.jsonld` | `None` | None | High | Specialized sector property for textiles lacking a general equivalent. | [REVIEWED] | [DONE] |
| `dppk:voltage` | `sectors/Electronics.jsonld` | `None` | None | High | Specific electrical property, usually modelled generically in core vocabularies. | [REVIEWED] | [DONE] |
| `dppk:voltageMaximum` | `sectors/Battery.jsonld` | `None` | None | High | Highly specialized electrical property for batteries. | [REVIEWED] | [DONE] |
| `dppk:voltageMinimum` | `sectors/Battery.jsonld` | `None` | None | High | Highly specialized electrical property for batteries. | [REVIEWED] | [DONE] |
