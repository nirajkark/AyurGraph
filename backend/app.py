import os
import json
from functools import lru_cache
from flask import Flask, request, jsonify
from flask_cors import CORS
from rdflib import Graph, Namespace, RDF, RDFS, URIRef, Literal
from typing import List, Dict, Any
from datetime import datetime
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage
from fuzzywuzzy import fuzz
import urllib.parse
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(BASE_DIR, "data", "ayurgraph.ttl")

app = Flask(__name__)
CORS(app)

# Load KG
graph = Graph()
try:
    graph.parse(DATA_PATH, format="turtle")
    logger.info(f"Loaded triples: {len(graph)}")
except Exception as e:
    logger.error(f"Failed to load KG: {e}")

# LLM Config
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
LLM_CONFIG = {
    "provider": "groq",
    "api_key": GROQ_API_KEY,
    "model": "Gemma2-9b-it"
}

class KnowledgeGraphRetriever:
    def __init__(self, graph):
        self.graph = graph
        self.entity_cache = self._build_entity_cache()
    
    def _build_entity_cache(self) -> Dict[str, List[tuple]]:
        cache = {k: [] for k in ["herbs", "conditions", "symptoms", "treatments", "doshas", "compounds", "preparations", "sources"]}
        queries = {
            "herbs": "SELECT ?entity ?label WHERE { ?entity a ayur:Herb ; rdfs:label ?label }",
            "conditions": "SELECT ?entity ?label WHERE { ?entity a ayur:Condition ; rdfs:label ?label }",
            "symptoms": "SELECT ?entity ?label WHERE { ?entity a ayur:Symptom ; rdfs:label ?label }",
            "treatments": "SELECT ?entity ?label WHERE { ?entity a ayur:Treatment ; rdfs:label ?label }",
            "doshas": "SELECT ?entity ?label WHERE { ?entity a ayur:Dosha ; rdfs:label ?label }",
            "compounds": "SELECT ?entity ?label WHERE { ?entity a ayur:Compound ; rdfs:label ?label }",
            "preparations": "SELECT ?entity ?label WHERE { ?entity a ayur:Preparation ; rdfs:label ?label }",
            "sources": "SELECT ?entity ?label WHERE { ?entity a ayur:Source ; rdfs:label ?label }"
        }
        for category, query in queries.items():
            results = self.execute_sparql(f"""
                PREFIX ayur: <http://example.org/ayurvedic/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                {query}
            """)
            cache[category] = [(r.get('label', 'Unknown'), r['entity']) for r in results if 'entity' in r]
        return cache
    
    @lru_cache(maxsize=1000)
    def execute_sparql(self, sparql_text: str) -> List[Dict]:
        try:
            results = self.graph.query(sparql_text)
            vars = [str(v) for v in results.vars] if results.vars else []
            out = []
            for row in results:
                d = {}
                for i, v in enumerate(vars):
                    try:
                        py = row[i].toPython()
                    except Exception:
                        py = str(row[i])
                    d[v] = py
                out.append(d)
            return out
        except Exception as e:
            logger.error(f"SPARQL error: {e}\nQuery: {sparql_text}")
            return []
    
    def find_similar_entities(self, text: str, entity_type: str = None) -> List[Dict]:
        text_lower = text.lower()
        matches = []
        categories = [entity_type] if entity_type else self.entity_cache.keys()
        for category in categories:
            for label, entity_uri in self.entity_cache[category]:
                similarity = fuzz.partial_ratio(text_lower, label.lower()) / 100.0
                if similarity > 0.6:
                    matches.append({
                        "type": category,
                        "label": label,
                        "uri": entity_uri,
                        "confidence": similarity
                    })
        return sorted(matches, key=lambda x: x['confidence'], reverse=True)[:10]
    
    @lru_cache(maxsize=1000)
    def get_entity_details(self, entity_uri: str) -> Dict:
        try:
            entity_uri = urllib.parse.quote(entity_uri, safe=':/?#[]@!$&()*+,;=')
            query = f"""
            PREFIX ayur: <http://example.org/ayurvedic/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?property ?value WHERE {{
                <{entity_uri}> ?property ?value .
            }}
            """
            results = self.execute_sparql(query)
            details = {"uri": entity_uri}
            for r in results:
                prop = r['property'].split('/')[-1]
                details.setdefault(prop, []).append(r['value'])
            return details
        except Exception as e:
            logger.error(f"Error fetching details for {entity_uri}: {e}")
            return {"uri": entity_uri, "error": str(e)}
    
    def get_visualization_data(self, entities: List[Dict] = None, relationships: Dict = None, full_graph: bool = False) -> Dict:
        nodes = set()
        edges = []
        if full_graph:
            try:
                for s, p, o in self.graph:
                    try:
                        # Skip invalid URIs or literals
                        if isinstance(s, Literal) or isinstance(o, Literal):
                            continue
                        # Get labels using graph.value
                        s_label = self.graph.value(s, RDFS.label) or s.split('/')[-1].replace('_', ' ').title()
                        o_label = self.graph.value(o, RDFS.label) or o.split('/')[-1].replace('_', ' ').title()
                        p_label = p.split('/')[-1].replace('_', ' ').title()
                        s_group = self._get_entity_type(s)
                        o_group = self._get_entity_type(o)
                        if s_group != 'unknown' and o_group != 'unknown':
                            nodes.add((str(s), str(s_label), s_group))
                            nodes.add((str(o), str(o_label), o_group))
                            edges.append({
                                "from": str(s),
                                "to": str(o),
                                "label": p_label
                            })
                    except Exception as e:
                        logger.warning(f"Skipping invalid triple ({s}, {p}, {o}): {e}")
            except Exception as e:
                logger.error(f"Error processing full graph: {e}")
                return {"nodes": [], "edges": [], "error": str(e)}
        else:
            entities = entities or []
            relationships = relationships or {}
            for entity in entities[:10]:
                nodes.add((entity['uri'], entity['label'], entity['type']))
                details = self.get_entity_details(entity['uri'])
                for prop in ['recommendedFor', 'hasSymptom', 'balancesDosha', 'containsHerb', 'treats']:
                    if prop in details:
                        for value in details[prop]:
                            label_query = f"""
                            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                            SELECT ?label WHERE {{ <{urllib.parse.quote(value, safe=':/?#[]@!$&()*+,;=')}> rdfs:label ?label }}
                            """
                            label_result = self.execute_sparql(label_query)
                            label = label_result[0]['label'] if label_result else value.split('/')[-1].replace('_', ' ').title()
                            nodes.add((value, label, prop))
                            edges.append({
                                "from": entity['uri'],
                                "to": value,
                                "label": prop.replace('_', ' ').title()
                            })
            for rel_key, items in relationships.items():
                for item in items:
                    from_uri = item.get('herb') or item.get('condition') or item.get('dosha') or item.get('symptom') or item.get('treatment') or ''
                    to_uri = item.get('condition') or item.get('herb') or item.get('dosha') or item.get('symptom') or item.get('treatment') or item.get('label') or ''
                    from_label = item.get('herbLabel') or item.get('conditionLabel') or item.get('label') or from_uri.split('/')[-1].replace('_', ' ').title()
                    to_label = item.get('conditionLabel') or item.get('herbLabel') or item.get('label') or to_uri.split('/')[-1].replace('_', ' ').title()
                    from_type = 'herb' if 'herb' in item else 'condition' if 'condition' in item else 'dosha' if 'dosha' in item else 'symptom' if 'symptom' in item else 'treatment'
                    to_type = 'condition' if 'condition' in item else 'herb' if 'herb' in item else 'dosha' if 'dosha' in item else 'symptom' if 'symptom' in item else 'treatment'
                    nodes.add((from_uri, from_label, from_type))
                    nodes.add((to_uri, to_label, to_type))
                    edges.append({
                        "from": from_uri,
                        "to": to_uri,
                        "label": 'Recommended For' if 'herb' in item else 'Treated By' if 'condition' in item else 'Balances Dosha' if 'dosha' in item else 'Has Symptom' if 'symptom' in item else 'Treats'
                    })

        group_colors = {
            "herbs": "#34d399",
            "conditions": "#fb7185",
            "symptoms": "#fbbf24",
            "treatments": "#6366f1",
            "doshas": "#22c55e",
            "compounds": "#3b82f6",
            "preparations": "#4ade80",
            "sources": "#10b981",
            "unknown": "#94a3b8"
        }
        vis_nodes = [
            {
                "id": uri,
                "label": label,
                "group": group,
                "shape": "dot" if group in ["herbs", "doshas", "compounds"] else "box" if group in ["conditions", "symptoms"] else "ellipse",
                "color": group_colors.get(group, "#94a3b8")
            }
            for uri, label, group in nodes if uri
        ]
        return {"nodes": vis_nodes, "edges": edges}
    
    def search_comprehensive(self, query: str) -> Dict:
        try:
            entities = self.find_similar_entities(query)
            detailed_results = []
            for entity in entities[:10]:
                details = self.get_entity_details(entity['uri'])
                detailed_results.append({**entity, "details": details})
            relationships = self._get_related_information(query, entities[:5])
            visualization = self.get_visualization_data(entities, relationships)
            return {
                "entities": detailed_results,
                "relationships": relationships,
                "visualization": visualization,
                "query": query
            }
        except Exception as e:
            logger.error(f"Error in search_comprehensive for query '{query}': {e}")
            return {"entities": [], "relationships": {}, "visualization": {"nodes": [], "edges": []}, "query": query, "error": str(e)}
    
    def _get_related_information(self, query: str, entities: List[Dict]) -> Dict:
        relationships = {}
        for entity in entities:
            entity_type = entity['type']
            uri = urllib.parse.quote(entity['uri'], safe=':/?#[]@!$&()*+,;=')
            if entity_type == 'herbs':
                cond_q = f"""
                PREFIX ayur: <http://example.org/ayurvedic/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?condition ?conditionLabel WHERE {{
                    <{uri}> ayur:recommendedFor ?condition .
                    ?condition rdfs:label ?conditionLabel .
                }}
                """
                conditions = self.execute_sparql(cond_q)
                if conditions:
                    relationships[f"{entity['label']}_treats"] = conditions
                dosha_q = f"""
                PREFIX ayur: <http://example.org/ayurvedic/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?dosha ?label WHERE {{
                    <{uri}> ayur:balancesDosha ?dosha .
                    ?dosha rdfs:label ?label .
                }}
                """
                doshas = self.execute_sparql(dosha_q)
                if doshas:
                    relationships[f"{entity['label']}_balances"] = doshas
            elif entity_type == 'conditions':
                herbs_q = f"""
                PREFIX ayur: <http://example.org/ayurvedic/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?herb ?herbLabel WHERE {{
                    ?herb ayur:recommendedFor <{uri}> .
                    ?herb rdfs:label ?herbLabel .
                }}
                """
                herbs = self.execute_sparql(herbs_q)
                if herbs:
                    relationships[f"{entity['label']}_herbs"] = herbs
                symptom_q = f"""
                PREFIX ayur: <http://example.org/ayurvedic/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?symptom ?label WHERE {{
                    <{uri}> ayur:hasSymptom ?symptom .
                    ?symptom rdfs:label ?label .
                }}
                """
                symptoms = self.execute_sparql(symptom_q)
                if symptoms:
                    relationships[f"{entity['label']}_symptoms"] = symptoms
                treatment_q = f"""
                PREFIX ayur: <http://example.org/ayurvedic/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?treatment ?label WHERE {{
                    ?treatment ayur:treats <{uri}> .
                    ?treatment rdfs:label ?label .
                }}
                """
                treatments = self.execute_sparql(treatment_q)
                if treatments:
                    relationships[f"{entity['label']}_treatments"] = treatments
            elif entity_type == 'treatments':
                herb_q = f"""
                PREFIX ayur: <http://example.org/ayurvedic/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?herb ?label WHERE {{
                    <{uri}> ayur:containsHerb ?herb .
                    ?herb rdfs:label ?label .
                }}
                """
                herbs = self.execute_sparql(herb_q)
                if herbs:
                    relationships[f"{entity['label']}_contains"] = herbs
                condition_q = f"""
                PREFIX ayur: <http://example.org/ayurvedic/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?condition ?label WHERE {{
                    <{uri}> ayur:treats ?condition .
                    ?condition rdfs:label ?label .
                }}
                """
                conditions = self.execute_sparql(condition_q)
                if conditions:
                    relationships[f"{entity['label']}_treats"] = conditions
            elif entity_type == 'symptoms':
                condition_q = f"""
                PREFIX ayur: <http://example.org/ayurvedic/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?condition ?label WHERE {{
                    ?condition ayur:hasSymptom <{uri}> .
                    ?condition rdfs:label ?label .
                }}
                """
                conditions = self.execute_sparql(condition_q)
                if conditions:
                    relationships[f"{entity['label']}_in_condition"] = conditions
        return relationships

    def get_full_graph(self) -> Dict:
        try:
            return self.get_visualization_data(full_graph=True)
        except Exception as e:
            logger.error(f"Failed to generate full graph: {e}")
            return {"nodes": [], "edges": [], "error": str(e)}
    
    def _get_entity_type(self, entity):
        try:
            for typ in self.graph.objects(entity, RDF.type):
                return str(typ).split(':')[-1].lower()
            return 'unknown'
        except Exception as e:
            logger.warning(f"Error getting type for {entity}: {e}")
            return 'unknown'

class LLMIntegration:
    def __init__(self, config):
        self.config = config
        self.model = None
        self._initialize_model()
    
    def _initialize_model(self):
        if self.config["provider"] == "groq" and self.config.get("api_key"):
            self.model = ChatGroq(
                model=self.config["model"],
                groq_api_key=self.config["api_key"],
                temperature=0.3,
                max_tokens=1500
            )
            logger.info(f"✅ Groq model {self.config['model']} initialized")
        else:
            logger.warning("⚠️ LLM not configured")
    
    def call_llm(self, system_prompt: str, user_message: str, context: str = "") -> str:
        if not self.model:
            return "LLM service not available."
        messages = [SystemMessage(content=system_prompt)]
        if context:
            messages.append(SystemMessage(content=f"Knowledge Graph Context:\n{context}"))
        messages.append(HumanMessage(content=user_message))
        try:
            response = self.model.invoke(messages)
            return response.content
        except Exception as e:
            logger.error(f"Error calling LLM: {e}")
            return f"Error calling LLM: {e}"

class AyurGraphChatbot:
    def __init__(self, kg_retriever, llm_integration):
        self.kg_retriever = kg_retriever
        self.llm = llm_integration
    
    def process_query(self, user_query: str, session_id: str = None) -> Dict:
        try:
            kg_results = self.kg_retriever.search_comprehensive(user_query)
            if "error" in kg_results:
                raise Exception(kg_results["error"])
            context = self._format_kg_context(kg_results).strip()
            has_kg = bool(context)

            base_prompt = (
                "You are an expert Ayurvedic consultant chatbot. "
                "Provide a clear, complete, and actionable answer based on Ayurvedic principles. "
                "Include specific herbs, treatments, and dosha-balancing methods when relevant. "
                "Structure the response with sections (e.g., Herbs, Treatments, Dosha Balance). "
                "This is for educational purposes only; always recommend consulting a professional for medical advice."
            )

            if has_kg:
                system_prompt = (
                    base_prompt +
                    "\nUse the Knowledge Graph context below to ground your answer with specific details. "
                    "Highlight relevant entities and relationships from the KG. "
                    "If something is uncertain, state likely options and what to observe."
                )
            else:
                system_prompt = (
                    base_prompt +
                    "\nNo specific KG data is provided. Use general Ayurvedic principles to provide a comprehensive answer. "
                    "Include likely dosha involvement, lifestyle guidance, and commonly used herbs. "
                    "Offer safe, general suggestions and note contraindications when appropriate."
                )

            llm_response = self.llm.call_llm(system_prompt, user_query, context if has_kg else "")
            return {
                "response": llm_response,
                "source": "kg_and_llm" if has_kg else "llm_only",
                "kg_data": kg_results,
                "confidence": "high" if has_kg else "medium"
            }
        except Exception as e:
            logger.error(f"Error processing query '{user_query}': {e}")
            return {
                "response": f"Error processing query: {str(e)}",
                "source": "error",
                "kg_data": {},
                "confidence": "low"
            }
    
    def _format_kg_context(self, kg_results: Dict) -> str:
        parts = []
        if kg_results.get("entities"):
            parts.append("Entities:")
            for e in kg_results["entities"]:
                parts.append(f"- {e['label']} ({e['type']}): {e['details'].get('description', ['No description'])[0]}")
                for prop, values in e['details'].items():
                    if prop not in ['uri', 'label', 'description']:
                        parts.append(f"  {prop}: {', '.join(values)}")
        if kg_results.get("relationships"):
            parts.append("Relationships:")
            for rel, items in kg_results["relationships"].items():
                pretty = [i.get("conditionLabel") or i.get("herbLabel") or i.get("label") or "" for i in items]
                parts.append(f"- {rel}: {', '.join(pretty)}")
        return "\n".join(parts)

# Initialize
kg_retriever = KnowledgeGraphRetriever(graph)
llm_integration = LLMIntegration(LLM_CONFIG)
chatbot = AyurGraphChatbot(kg_retriever, llm_integration)

@app.route("/api/chat", methods=["POST"])
def chat_api():
    try:
        data = request.get_json(force=True) or {}
        query = data.get("query") or data.get("message") or ""
        if not isinstance(query, str):
            query = str(query or "")
        query = query.strip()
        if query.lower() in {"", "undefined", "null", "none"}:
            query = "Give me an overview of Ayurveda and how this chatbot can help."

        result = chatbot.process_query(query)
        return jsonify({
            "query": query,
            "response": result["response"],
            "source": result["source"],
            "confidence": result["confidence"],
            "timestamp": datetime.now().isoformat(),
            "kg_data": result.get("kg_data", {})
        })
    except Exception as e:
        logger.error(f"Error in chat_api: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/kg/full", methods=["GET"])
def full_kg_api():
    try:
        full_graph = kg_retriever.get_full_graph()
        if "error" in full_graph:
            logger.error(f"Full KG error: {full_graph['error']}")
            return jsonify({"error": full_graph["error"]}), 500
        logger.info(f"Full KG loaded: {len(full_graph['nodes'])} nodes, {len(full_graph['edges'])} edges")
        return jsonify(full_graph)
    except Exception as e:
        logger.error(f"Error in full_kg_api: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)  # Disable debug to prevent watchdog issues