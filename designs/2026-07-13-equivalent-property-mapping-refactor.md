# Design Notes: Improving Equivalent Property Mappings

## Context
Currently, the use of standard `owl:equivalentProperty` is introducing rigid semantic dependencies. Standard W3C reasoners and SHACL engines natively interpret `owl:equivalentProperty` as an imperative rule demanding inferencing and identical evaluation across disparate shapes. This causes widespread JSON-LD and shape mapping friction where external property data doesn't cleanly match our internal payload structure.

## Goal
Decouple our internal property mappings from strict Semantic Web reasoning logic while maintaining robust mapping capabilities where needed for internal tools (like the EPREL Excel generator).

## Proposed Solution Direction
1. **Transition from `owl:equivalentProperty` to a custom structural annotation.**
2. **Define `dppk:equivalentProperty`** as an internal placeholder mapping property. 
3. Because standard tools natively ignore un-standardized W3C predicates, SHACL and third-party inference engines will safely skip these annotations, eradicating unwanted logic loops or false-positive invalidations.
4. Internal adapter scripts can selectively be built to target `dppk:equivalentProperty` independently if cross-mapping is absolutely required for a localized feature.
