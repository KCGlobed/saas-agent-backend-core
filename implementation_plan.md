# Implementation Plan — Improving RAG Retrieval Accuracy

## Goal
Improve the reliability of the AI's answers when queries are phrased differently (e.g., "is commerce background compulsory..." vs "commerce background compulsory..."). 

The current issue is that short or keyword-heavy queries may not generate embeddings that closely match the relevant document chunks in ChromaDB, leading to retrieval failure.

## Proposed Changes

### 1. backend-ai — Query Transformation (Query Expansion)

We will implement a **Query Rewriter** in the `backend-ai` service. Before performing a semantic search, we will use a lightweight LLM call to transform the user's raw query into a search-optimized question.

#### [NEW] `query_optimizer.py` — `backend-ai/app/services/query_optimizer.py`
- Create a service that takes the user's query and returns a search-optimized version.
- Example: "commerce background compulsory for CMA?" → "What are the commerce background requirements or eligibility criteria for the CMA course?"

#### [MODIFY] `rag.py` — `backend-ai/app/services/rag.py`
- Update `build_rag_context` to first call the query optimizer.
- Use the **optimized query** for embedding generation and ChromaDB search.
- Use the **original query** for the final LLM chat response (to maintain user context).

---

### 2. backend-ai — Retrieval Tuning

#### [MODIFY] `rag.py` — `backend-ai/app/services/rag.py`
- Increase `top_k` from 5 to 7 or 8 to provide more context to the LLM.
- Add a small check to ensure whitespace and punctuation don't interfere with retrieval.

---

### 3. backend-core — System Prompt Refinement

#### [MODIFY] `chat.js` — `backend-core/src/controllers/chat.js`
- Slightly relax the `strictDocumentOnlyPrompt` to encourage the AI to be more conversational even if context is thin, while still maintaining grounding.

---

## Why this makes it "Perfect"
1. **Phrasing Independence**: By rewriting "commerce background compulsory for CMA?" into a full question, we ensure the embedding is rich and covers synonyms like "requirements", "eligibility", and "qualifications".
2. **Context Richness**: Higher `top_k` reduces the chance of missing the answer if it's buried in the 6th or 7th most relevant chunk.
3. **No User Effort**: The user can continue asking naturally or with keywords; the system handles the complexity of "thinking" like a search engine.

---

## Open Questions
1. **Latency**: Adding an extra LLM call for query expansion adds ~500ms-1s to the response time. Is this acceptable for better accuracy? (Recommended: Yes).
2. **Model for Expansion**: Should we use the same model as the project (e.g., GPT-4o) or a cheaper/faster one (e.g., GPT-4o-mini) for expansion? (Recommended: GPT-4o-mini).

---

## Verification Plan

### Automated Tests
- Test "is commerce background compulsory for CMA?" → Expect answer.
- Test "commerce background compulsory for CMA?" → Expect same/similar answer.
- Test "CMA commerce requirement" → Expect answer.

### Manual Verification
- Verify in the frontend chat widget that variations of the same question now yield consistent results.
- Check logs to see the "Optimized Query" being used for retrieval.
