// Maps internal sector IDs to their UI display names
export const SECTOR_DISPLAY_NAMES = {
    'battery-ev': 'Battery (EV)',
    'battery-lmv': 'Battery (LMV)',
    'battery-industrial': 'Battery (Industrial)',
    'construction': 'Construction',
    'electronics': 'Electronics',
    'iron-steel': 'Iron or Steel',
    'textile': 'Textile',
    'packaging': 'Packaging',
    'general-product': 'General Product Information'
};

// Maps internal sector IDs to their Context filenames
export const SECTOR_CONTEXT_MAP = {
    'battery-ev': 'dpp-battery.context.jsonld',
    'battery-lmv': 'dpp-battery.context.jsonld',
    'battery-industrial': 'dpp-battery.context.jsonld',
    'construction': 'dpp-construction.context.jsonld',
    'electronics': 'dpp-electronics.context.jsonld',
    'iron-steel': 'dpp-iron-steel.context.jsonld',
    'textile': 'dpp-textile.context.jsonld',
    'packaging': 'dpp-packaging.context.jsonld',
    'dpp': 'dpp-core.context.jsonld',
    'general-product': 'dpp-general-product.context.jsonld'
};

// Maps internal sector IDs to their Ontology filenames
export const SECTOR_ONTOLOGY_MAP = {
    'battery-ev': 'sectors/Battery.jsonld',
    'battery-lmv': 'sectors/Battery.jsonld',
    'battery-industrial': 'sectors/Battery.jsonld',
    'construction': 'sectors/Construction.jsonld',
    'electronics': 'sectors/Electronics.jsonld',
    'iron-steel': 'sectors/IronSteel.jsonld',
    'textile': 'sectors/Textile.jsonld',
    'dpp': 'dpp-ontology.jsonld',
    'general-product': 'core/Product.jsonld',
    'packaging': 'core/Compliance.jsonld'
};

// Maps internal sector IDs to their Schema filenames
export const SECTOR_SCHEMA_MAP = {
    'battery-ev': 'sector/battery-ev.schema.json',
    'battery-lmv': 'sector/battery-lmv.schema.json',
    'battery-industrial': 'sector/battery-industrial.schema.json',
    'construction': 'sector/construction.schema.json',
    'electronics': 'sector/electronics.schema.json',
    'iron-steel': 'sector/iron-steel.schema.json',
    'textile': 'sector/textile.schema.json',
    'packaging': 'sector/packaging.schema.json'
};

// Maps public Content Specification URLs to internal sector IDs
export const SPEC_URL_TO_SECTOR_MAP = {
    'draft_battery_specification_id': 'battery', // Legacy fallback if needed
    'https://dpp-keystone.org/spec/validation/v3/json-schema/sector/battery-ev.schema.json': 'battery-ev',
    'https://dpp-keystone.org/spec/validation/v3/json-schema/sector/battery-lmv.schema.json': 'battery-lmv',
    'https://dpp-keystone.org/spec/validation/v3/json-schema/sector/battery-industrial.schema.json': 'battery-industrial',
    'draft_construction_specification_id': 'construction',
    'draft_electronics_specification_id': 'electronics',
    'draft_iron_and_steel_specification_id': 'iron-steel',
    'draft_textile_espr_specification_id': 'textile'
};

// Common schemas that should always be loaded for $ref resolution in the browser validator
export const COMMON_SCHEMAS = [
    'shared/dopc.schema.json',
    'shared/epd.schema.json',
    'shared/organization.schema.json',
    'shared/packaging.schema.json',
    'shared/postal-address.schema.json',
    'shared/product-characteristic.schema.json',
    'shared/related-resource.schema.json',
    'shared/general-product.schema.json',
    'shared/component.schema.json',
    'shared/mtc.schema.json',
    'shared/certification.schema.json'
];
