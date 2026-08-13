import json
import os

with open('src/validation/v3/json-schema/sector/battery.schema.json', 'r') as f:
    base_schema = json.load(f)

def create_schema(category_name, spec_id, required_fields, forbidden_fields):
    schema = json.loads(json.dumps(base_schema))
    schema['$id'] = f"https://dpp-keystone.org/spec/validation/{{{{VERSION}}}}/json-schema/sector/{category_name}.schema.json"
    schema['title'] = f"DPP for Batteries - {category_name.upper()} (Draft)"
    schema['description'] = f"A conditional schema that applies if the DPP is for the {category_name.upper()} battery sector."
    
    # Remove deprecated flag if it exists (since we deprecated the base one)
    schema.pop('deprecated', None)
    
    schema['if']['properties']['contentSpecificationIds']['contains']['const'] = spec_id
    
    def apply_forbidden(obj, path):
        parts = path.split('.')
        curr = obj
        for p in parts[:-1]:
            if p not in curr['properties']: return
            curr = curr['properties'][p]
        if parts[-1] in curr.get('properties', {}):
            curr['properties'][parts[-1]] = {"not": {}}
    
    for f in forbidden_fields:
        apply_forbidden(schema['then'], f)
        
    def apply_required(obj, path):
        parts = path.split('.')
        curr = obj
        for p in parts[:-1]:
            if p not in curr['properties']:
                return
            if 'required' not in curr:
                curr['required'] = []
            if p not in curr['required']:
                curr['required'].append(p)
            curr = curr['properties'][p]
            
        if 'required' not in curr:
            curr['required'] = []
        if parts[-1] not in curr['required']:
            curr['required'].append(parts[-1])
            
    schema['then'].pop('required', None)
    
    for r in required_fields:
        apply_required(schema['then'], r)
        
    with open(f'src/validation/v3/json-schema/sector/{category_name}.schema.json', 'w') as f:
        json.dump(schema, f, indent=4)

base_mandatory = [
    "manufacturerInfo", "manufacturingPlace", "manufacturingDate", 
    "batteryCategory", "batteryMass", "batteryStatus", 
    "separateCollectionSymbol", "extinguishingAgent", "testReports", 
    "batteryChemistry", "criticalRawMaterials", "hazardousSubstances", 
    "dismantlingInformation", "partNumbers", "sparePartsSources", 
    "safetyMeasures", "wastePreventionInfo", "postConsumerRecycledMaterialComposition", 
    "renewableContent", "dopc", "performance.capacity.rated", 
    "performance.capacity.voltageMin", "performance.capacity.voltageNominal", 
    "performance.capacity.voltageMax", "performance.power.original", 
    "performance.temperature.idleLower", "performance.temperature.idleUpper", 
    "performance.internalResistance.initial"
]

base_forbidden = [
    "materialComposition", "carbonFootprintClass", "carbonFootprintStudy", 
    "carbonFootprintGeneralInfo", "carbonFootprintAbsolute", 
    "carbonFootprintLabel", "dueDiligenceReport"
]

ev_required = base_mandatory + [
    "performance.lifetime.cycles", "performance.lifetime.referenceTest", 
    "performance.lifetime.exhaustionThreshold", "performance.efficiency.roundTripInitial", 
    "performance.efficiency.roundTripAt50Cycles", "performance.lifetime.cRateTest", 
    "performance.capacity.soce"
]

ev_forbidden = base_forbidden + [
    "performance.capacity.remaining", "performance.power.remaining", 
    "performance.efficiency.roundTripRemaining", "performance.efficiency.selfDischargeEvolution"
]

lmv_required = base_mandatory + [
    "performance.lifetime.cycles", "performance.lifetime.referenceTest", 
    "performance.efficiency.roundTripInitial", 
    "performance.efficiency.roundTripAt50Cycles", "performance.lifetime.cRateTest", 
    "performance.capacity.remaining", "performance.power.remaining", 
    "performance.efficiency.roundTripRemaining", "performance.efficiency.selfDischargeEvolution"
]

lmv_forbidden = base_forbidden + [
    "performance.lifetime.exhaustionThreshold", "performance.capacity.soce"
]

industrial_required = base_mandatory + []

industrial_forbidden = base_forbidden + [
    "performance.lifetime.exhaustionThreshold", "performance.capacity.soce"
]

create_schema('battery-ev', 'https://dpp-keystone.org/spec/validation/{{VERSION}}/json-schema/sector/battery-ev.schema.json', ev_required, ev_forbidden)
create_schema('battery-lmv', 'https://dpp-keystone.org/spec/validation/{{VERSION}}/json-schema/sector/battery-lmv.schema.json', lmv_required, lmv_forbidden)
create_schema('battery-industrial', 'https://dpp-keystone.org/spec/validation/{{VERSION}}/json-schema/sector/battery-industrial.schema.json', industrial_required, industrial_forbidden)

print("Schemas generated successfully.")
