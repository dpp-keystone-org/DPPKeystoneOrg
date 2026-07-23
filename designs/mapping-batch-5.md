# Mapping Batch 5 of 8

| Term (`@id`) | File | Current `equivalent` | Proposed SKOS Mappings | Confidence | Rationale | QC Status | JSON-LD Updated? |
|---|---|---|---|---|---|---|---|
| `dppk:packaging` | `core/Compliance.jsonld` | `gs1:packaging` | `skos:exactMatch gs1:packaging` | High | GS1 provides an exact property for packaging. | [REVIEWED] | [DONE] |
| `dppk:Packaging` | `core/Compliance.jsonld` | `gs1:PackagingMaterialDetails` | `skos:exactMatch gs1:PackagingMaterialDetails` | High | GS1 has a direct class for packaging material details. | [REVIEWED] | [DONE] |
| `dppk:packagingMaterialCompositionQuantity` | `core/Compliance.jsonld` | `gs1:packagingMaterialCompositionQuantity` | `skos:exactMatch gs1:packagingMaterialCompositionQuantity` | High | Exact property match in GS1. | [REVIEWED] | [DONE] |
| `dppk:packagingMaterialType` | `core/Compliance.jsonld` | `gs1:packagingMaterialType` | `skos:exactMatch gs1:packagingMaterialType` | High | Exact property match in GS1. | [REVIEWED] | [DONE] |
| `dppk:packagingRecycledContent` | `core/Compliance.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept with no direct equivalent in general vocabularies. | [REVIEWED] | [DONE] |
| `dppk:packagingRecyclingProcessType` | `core/Compliance.jsonld` | `gs1:packagingRecyclingProcessType` | `skos:exactMatch gs1:packagingRecyclingProcessType` | High | GS1 provides an exact property for packaging recycling process type. | [REVIEWED] | [DONE] |
| `dppk:packagingSubstanceOfConcern` | `core/Compliance.jsonld` | `None` | `None` | High | Specific to EU ESPR regulatory requirements for substances of concern. | [REVIEWED] | [DONE] |
| `dppk:partNumbers` | `sectors/Battery.jsonld` | `None` | `skos:closeMatch schema:mpn` | High | Schema.org mpn (Manufacturer Part Number) is a close match for part numbers. | [REVIEWED] | [DONE] |
| `dppk:PefcrApparelAccessories` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrBoots` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:pefcrCategory` | `sectors/Textile.jsonld` | `None` | `skos:relatedMatch schema:category` | Medium | Loosely maps to schema.org category property. | [REVIEWED] | [DONE] |
| `dppk:PefcrCategoryValue` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category class without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrClosedToedShoes` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrDressesSkirtsAndJumpsuits` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrJacketsAndCoats` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrLeggingsStockingsTightsAndSocks` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrOpenToedShoes` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrPantsAndShorts` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrShirtsAndBlouses` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrSweatersAndMidlayers` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrSwimwear` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrTShirts` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:PefcrUnderwear` | `sectors/Textile.jsonld` | `None` | `None` | High | Specific PEFCR category value without an exact equivalent in standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:performance` | `sectors/Battery.jsonld` | `None` | `skos:relatedMatch schema:additionalProperty` | Medium | Battery performance is a specialized container loosely related to generic properties. | [REVIEWED] | [DONE] |
| `dppk:PostalAddress` | `core/Organization.jsonld` | `schema:PostalAddress<br>gs1:Address<br>unece:TradeAddress` | `skos:exactMatch schema:PostalAddress<br>skos:exactMatch gs1:Address<br>skos:exactMatch unece:TradeAddress` | High | Exact class matches across all three major vocabularies. | [REVIEWED] | [DONE] |
| `dppk:postalCode` | `core/Organization.jsonld` | `schema:postalCode<br>gs1:postalCode` | `skos:exactMatch schema:postalCode<br>skos:exactMatch gs1:postalCode` | High | Exact property matches in Schema.org and GS1. | [REVIEWED] | [DONE] |
| `dppk:postConsumerRecycledContent` | `sectors/IronSteel.jsonld` | `None` | `skos:relatedMatch schema:material` | Medium | Related to the material composition of the product, but no exact property for post-consumer content. | [REVIEWED] | [DONE] |
| `dppk:postConsumerRecycledContentMass` | `sectors/Textile.jsonld` | `None` | `skos:relatedMatch schema:weight` | Medium | Represents a mass measurement loosely related to generic weight. | [REVIEWED] | [DONE] |
| `dppk:postConsumerRecycledContentPercentage` | `sectors/Textile.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:postConsumerRecycledMaterialComposition` | `sectors/Battery.jsonld` | `None` | `skos:relatedMatch schema:material` | Medium | Loosely relates to the material composition of the product. | [REVIEWED] | [DONE] |
| `dppk:postConsumerTypeOfWaste` | `sectors/Textile.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:power` | `sectors/Battery.jsonld` | `None` | `skos:relatedMatch schema:additionalProperty` | Medium | Loosely related to a generic property or specification. | [REVIEWED] | [DONE] |
| `dppk:powerEnergyRatio` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:powerFade` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:PowerInfo` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:powerMaximumPermitted` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:powerOriginal` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:powerRemaining` | `sectors/Battery.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:PowerTool` | `sectors/Electronics.jsonld` | `None` | `None` | High | A power tool is a type of product, close to the generic product class. | [CORRECTED] | [DONE] |
| `dppk:preConsumerRecycledContent` | `sectors/IronSteel.jsonld` | `None` | `skos:relatedMatch schema:material` | Medium | Related to the material composition of the product. | [REVIEWED] | [DONE] |
| `dppk:preConsumerRecycledContentMass` | `sectors/Textile.jsonld` | `None` | `skos:relatedMatch schema:weight` | Medium | Represents a mass measurement loosely related to generic weight. | [REVIEWED] | [DONE] |
| `dppk:preConsumerRecycledContentPercentage` | `sectors/Textile.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:preConsumerRecycledMaterialComposition` | `sectors/Battery.jsonld` | `None` | `skos:relatedMatch schema:material` | Medium | Loosely relates to the material composition of the product. | [REVIEWED] | [DONE] |
| `dppk:preConsumerTypeOfWaste` | `sectors/Textile.jsonld` | `None` | `None` | High | Highly specialized internal DPP concept. | [REVIEWED] | [DONE] |
| `dppk:primaryDimension` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `skos:closeMatch schema:size` | High | Apparel primary dimension is closely related to schema:size. | [REVIEWED] | [DONE] |
| `dppk:primaryDimensionValue` | `sectors/EUApparelSizeSystem.jsonld` | `None` | `skos:closeMatch schema:size` | High | Apparel primary dimension value is closely related to schema:size. | [REVIEWED] | [DONE] |
| `dppk:Product` | `core/Product.jsonld` | `schema:Product<br>gs1:Product<br>unece:TradeProduct<br>eudpp:Product` | `skos:exactMatch schema:Product<br>skos:exactMatch gs1:Product<br>skos:exactMatch unece:TradeProduct<br>skos:exactMatch eudpp:Product` | High | Exact class matches across standard vocabularies. | [REVIEWED] | [DONE] |
| `dppk:ProductCharacteristic` | `core/Product.jsonld` | `gs1:ProductCharacteristic<br>schema:PropertyValue` | `skos:exactMatch gs1:ProductCharacteristic<br>skos:closeMatch schema:PropertyValue` | High | Exact match with GS1, and close match to schema:PropertyValue. | [REVIEWED] | [DONE] |
| `dppk:productCharacteristics` | `core/Product.jsonld` | `None` | `skos:relatedMatch schema:additionalProperty` | Medium | Loosely maps to schema:additionalProperty for defining product traits. | [REVIEWED] | [DONE] |
| `dppk:productionLocationCountry` | `core/Compliance.jsonld` | `gs1:countryCode` | `skos:exactMatch gs1:countryCode<br>skos:closeMatch schema:countryOfOrigin` | High | GS1 countryCode is an exact match; schema:countryOfOrigin is a close match. | [REVIEWED] | [DONE] |
