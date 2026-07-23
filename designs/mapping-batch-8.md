# Mapping Batch 8 of 8

| Term (`@id`) | File | Current `equivalent` | Proposed SKOS Mappings | Confidence | Rationale | QC Status | JSON-LD Updated? |
|---|---|---|---|---|---|---|---|
| `dppk:voltageNominal` | `sectors/Battery.jsonld` | `None` | `None` | High | No equivalent property for nominal voltage found in general vocabularies. | [REVIEWED] | [DONE] |
| `dppk:warrantyDuration` | `core/Product.jsonld` | `None` | `skos:relatedMatch schema:durationOfWarranty` | High | Schema.org models this on WarrantyPromise rather than directly on the product. | [REVIEWED] | [DONE] |
| `dppk:warrantyPeriod` | `sectors/Battery.jsonld` | `None` | `skos:relatedMatch schema:durationOfWarranty` | Medium | Conceptually relates to warranty duration but is modelled as a string on the battery. | [REVIEWED] | [DONE] |
| `dppk:wastePreventionInfo` | `sectors/Battery.jsonld` | `None` | `None` | High | Specific regulatory information property without general ontology equivalents. | [REVIEWED] | [DONE] |
| `dppk:website` | `core/Organization.jsonld` | `schema:url` | `skos:exactMatch schema:url` | High | schema:url is the standard property in schema.org for providing an organization's website. | [REVIEWED] | [DONE] |
| `dppk:weeeCategory` | `sectors/Electronics.jsonld` | `None` | `None` | High | Specific regulatory classification without a direct mapping in general ontologies. | [REVIEWED] | [DONE] |
| `dppk:weightExcludingTrims` | `sectors/Textile.jsonld` | `None` | `skos:relatedMatch schema:weight` | High | Associates with the general schema:weight but specialized to exclude trims. | [REVIEWED] | [DONE] |
| `dppk:width` | `core/Product.jsonld` | `schema:width` | `skos:exactMatch schema:width`<br>`skos:exactMatch gs1:width` | High | Exact semantic equivalence to schema:width and gs1:width. | [REVIEWED] | [DONE] |
