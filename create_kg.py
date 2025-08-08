
from rdflib import Graph, Namespace, RDF, RDFS, Literal, URIRef
import os

OUT_DIR = "data"
OUT_FILE = os.path.join(OUT_DIR, "ayurvedic_kg.ttl")

os.makedirs(OUT_DIR, exist_ok=True)

g = Graph()
AYUR = Namespace("http://example.org/ayurvedic/")
g.bind("ayur", AYUR)


for cls in ["Herb", "Condition", "Dosha", "Treatment", "Symptom", "Compound", "Preparation", "Source"]:
    g.add((AYUR[cls], RDF.type, RDFS.Class))


desc = AYUR["description"]
g.add((desc, RDF.type, RDF.Property))


herbs = [
    ("h_ashwagandha", "Ashwagandha", "Adaptogen used for stress, fatigue and vitality."),
    ("h_tulsi", "Tulsi", "Used for respiratory complaints and general immune support."),
    ("h_brahmi", "Brahmi", "Traditionally used for memory and cognition."),
    ("h_shatavari", "Shatavari", "Used in female reproductive health and vitality."),
    ("h_neem", "Neem", "Used for skin problems and as an antiseptic."),
    ("h_triphala", "Triphala", "A classical formulation used for digestion and detox."),
    ("h_guduchi", "Guduchi", "Used as an immunomodulatory herb."),
    ("h_licorice", "Licorice", "Soothing for the throat; used in some formulations."),
    ("h_cardamom", "Cardamom", "Digestive aid and aromatic spice."),
    ("h_clove", "Clove", "Used for dental pain and as a carminative."),
    ("h_musta", "Musta", "Used for digestive disorders."),
    ("h_arjuna", "Arjuna", "Cardiac supportive herb in classical texts."),
    ("h_guggulu", "Guggulu", "Used in musculoskeletal and lipid disorders."),
    ("h_haldi", "Turmeric", "Anti-inflammatory uses in traditional texts."),
    ("h_saffron", "Saffron", "Used in small quantities for mood and complexion.")
]

conditions = [
    ("c_common_cold", "Common Cold"),
    ("c_fever", "Fever"),
    ("c_anxiety", "Anxiety"),
    ("c_diarrhea", "Diarrhea"),
    ("c_skin_allergy", "Skin Allergy"),
    ("c_diabetes", "Diabetes"),
    ("c_arthritis", "Arthritis"),
    ("c_indigestion", "Indigestion"),
    ("c_insomnia", "Insomnia"),
    ("c_memory_loss", "Memory Loss")
]

doshas = [
    ("d_vata", "Vata"),
    ("d_pitta", "Pitta"),
    ("d_kapha", "Kapha")
]

treatments = [
    ("t_herbal_tea", "Herbal Tea", "Infusion/tea containing specific herbs."),
    ("t_oil_therapy", "Oil Therapy", "Topical oil application or massage."),
    ("t_panchakarma", "Panchakarma", "Cleansing therapies."),
    ("t_detox_drink", "Detox Drink", "Formulated drinks for cleansing."),
    ("t_meditation", "Meditation", "Mind-body practice.")
]

symptoms = [
    ("s_fever", "Fever"),
    ("s_cough", "Cough"),
    ("s_joint_pain", "Joint Pain"),
    ("s_rash", "Rash"),
    ("s_stress", "Stress"),
    ("s_fatigue", "Fatigue"),
    ("s_bloating", "Bloating"),
    ("s_insomnia", "Insomnia"),
    ("s_forgetfulness", "Forgetfulness")
]


for nid, label, text in herbs:
    node = AYUR[nid]
    g.add((node, RDF.type, AYUR.Herb))
    g.add((node, RDFS.label, Literal(label)))
    g.add((node, desc, Literal(text)))

for nid, label in conditions:
    node = AYUR[nid]
    g.add((node, RDF.type, AYUR.Condition))
    g.add((node, RDFS.label, Literal(label)))
    g.add((node, desc, Literal(f"Condition: {label}")))

for nid, label in doshas:
    node = AYUR[nid]
    g.add((node, RDF.type, AYUR.Dosha))
    g.add((node, RDFS.label, Literal(label)))

for nid, label, text in treatments:
    node = AYUR[nid]
    g.add((node, RDF.type, AYUR.Treatment))
    g.add((node, RDFS.label, Literal(label)))
    g.add((node, desc, Literal(text)))

for nid, label in symptoms:
    node = AYUR[nid]
    g.add((node, RDF.type, AYUR.Symptom))
    g.add((node, RDFS.label, Literal(label)))

def add_rel(sub, pred, obj):
    g.add((AYUR[sub], AYUR[pred], AYUR[obj]))


add_rel("t_herbal_tea", "containsHerb", "h_tulsi")
add_rel("t_herbal_tea", "containsHerb", "h_cardamom")
add_rel("t_herbal_tea", "treats", "c_common_cold")
add_rel("h_ashwagandha", "balancesDosha", "d_vata")
add_rel("h_brahmi", "recommendedFor", "c_memory_loss")
add_rel("h_shatavari", "recommendedFor", "c_indigestion")
add_rel("h_neem", "recommendedFor", "c_skin_allergy")
add_rel("t_oil_therapy", "containsHerb", "h_guggulu")
add_rel("t_oil_therapy", "treats", "c_arthritis")
add_rel("h_triphala", "recommendedFor", "c_indigestion")
add_rel("h_guduchi", "recommendedFor", "c_fever")
add_rel("h_arjuna", "recommendedFor", "c_diabetes")
add_rel("t_meditation", "treats", "c_anxiety")
add_rel("h_guggulu", "balancesDosha", "d_vata")
add_rel("h_haldi", "recommendedFor", "c_skin_allergy")
add_rel("h_licorice", "recommendedFor", "c_cough" )
add_rel("h_clove", "recommendedFor", "c_common_cold")
add_rel("h_triphala", "balancesDosha", "d_kapha")
add_rel("c_common_cold", "hasSymptom", "s_cough")
add_rel("c_fever", "hasSymptom", "s_fever")
add_rel("c_arthritis", "hasSymptom", "s_joint_pain")
add_rel("c_skin_allergy", "hasSymptom", "s_rash")
add_rel("c_anxiety", "hasSymptom", "s_stress")
add_rel("h_saffron", "recommendedFor", "c_insomnia")
add_rel("t_detox_drink", "containsHerb", "h_triphala")
add_rel("t_detox_drink", "treats", "c_fatigue")
add_rel("h_musta", "recommendedFor", "c_diarrhea")
add_rel("h_cardamom", "balancesDosha", "d_pitta")
add_rel("h_guduchi", "balancesDosha", "d_kapha")
add_rel("h_ashwagandha", "recommendedFor", "c_stress" if False else "c_anxiety")  


g.add((AYUR["cmp_withanolide"], RDF.type, AYUR.Compound))
g.add((AYUR["cmp_withanolide"], RDFS.label, Literal("Withanolide")))

g.add((AYUR["prep_oleation"], RDF.type, AYUR.Preparation))
g.add((AYUR["prep_oleation"], RDFS.label, Literal("Oleation (Snehana)")))

g.add((AYUR["source_bhavaprakasha"], RDF.type, AYUR.Source))
g.add((AYUR["source_bhavaprakasha"], RDFS.label, Literal("Bhavaprakasha")))

# Serialize
g.serialize(destination=OUT_FILE, format="turtle")
print("Wrote KG to", OUT_FILE)
