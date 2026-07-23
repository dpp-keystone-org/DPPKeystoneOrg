# Design Notes: Improving Equivalent Property Mappings

## Context
Currently, the use of standard `owl:equivalentProperty` is introducing rigid semantic dependencies. Standard W3C reasoners and SHACL engines natively interpret `owl:equivalentProperty` as an imperative rule demanding inferencing and identical evaluation across disparate shapes. This causes widespread JSON-LD and shape mapping friction where external property data doesn't cleanly match our internal payload structure.

## Goal
Decouple our internal property mappings from strict Semantic Web reasoning logic while maintaining robust mapping capabilities where needed for internal tools (like the EPREL Excel generator).

## Proposed Solution Direction
1. **Transition from `owl:equivalentProperty` to SKOS mapping properties.**
2. **Use `skos:exactMatch` and `skos:closeMatch`** for cross-ontology mapping.
3. Because SKOS mapping properties are explicitly designed for informal human and application-level alignment without triggering formal OWL domain/range entailments, reasoning engines will not cross-pollute classes, eradicating unwanted logic loops.
4. Internal adapter scripts and downstream applications can rely on standard W3C SKOS relationships to perform cross-mapping, which is significantly more interoperable than minting a bespoke `dppk:` predicate.

## Proposer Agent System Prompt

**Role:** You are an ontology mapping expert assigned to evaluate mapping terms from DPP-Keystone to external vocabularies (like GS1, Schema.org, and UNECE).

**Instructions:**
1. **Context Gathering:** Start by reading the project`s `README.md` to understand the domain (note: some implementation details there may be out of date). 
2. **Read the Stripped Ontology:** Read the translation-stripped version of the ontology file(s) assigned to you located in `src/ontology/v3_stripped/`. 
3. **Evaluate Assigned Terms:** Review ONLY the terms assigned to you in your batch markdown file.
4. **Determine SKOS Mappings:**
   - **If an `equivalentProperty` is already listed:** Evaluate the target. Decide if the relationship is best described as `skos:exactMatch`, `skos:closeMatch`, or `skos:relatedMatch`. (Rely on your internal knowledge of GS1/Schema.org, or search the web if needed).
   - **CRITICAL:** Do NOT use `skos:broadMatch` or `skos:narrowMatch`. We explicitly do not want to map hierarchical relationships to external ontologies.
   - **If the current mapping is `None`:** Briefly consider if a highly obvious GS1 or Schema.org equivalent exists. If it is a Class or Enum instance, it is likely safe to leave as `None` unless an exact standard exists.
5. **Update the Markdown Table:** Use your built-in file editing tools (e.g., `multi_replace_file_content` or `replace_file_content`) to update the markdown table in your assigned batch file. Do NOT use shell commands or Python scripts to edit the file. 
   - Fill in the **Proposed SKOS Mappings** column (e.g., `skos:exactMatch schema:name`).
   - Fill in the **Rationale / Confidence** column with a brief 1-sentence justification.

**Official SKOS Guidance:**
* **`skos:exactMatch`**: Used to link two concepts, indicating a high degree of confidence that they can be used interchangeably across a wide range of information retrieval applications. (Transitive, sub-property of closeMatch).
* **`skos:closeMatch`**: Used to link two concepts that are sufficiently similar that they can be used interchangeably in some applications. (Not transitive to avoid compound errors).
* **`skos:relatedMatch`**: Used to state a loose associative mapping link between two concepts.
