```markdown
# AyurGraph: Ayurvedic Knowledge Graph Chatbot

AyurGraph is a web-based chatbot that leverages a knowledge graph and AI to provide insights into Ayurvedic principles, herbs, treatments, and dosha-balancing methods. The backend uses Flask and RDFLib to query a Turtle-based knowledge graph (`ayurgraph.ttl`), while the frontend, built with React and `vis-network`, visualizes the knowledge graph and handles user interactions. The Groq API powers the chatbot's responses.

## Features

- **Chat Interface**: Ask about Ayurvedic herbs, remedies, and practices (e.g., "Herbs for stress relief").
- **Knowledge Graph Visualization**: View query-specific or full knowledge graphs showing herbs, conditions, symptoms, treatments, and doshas.
- **Fuzzy Search**: Handles misspellings in queries using fuzzy matching.
- **LLM Integration**: Uses the Groq API (Gemma2-9b-it model) for natural language responses grounded in Ayurvedic knowledge.
- **Responsive Design**: Modern UI with animated elements and quick question prompts.

## Project Structure

- `backend/`
  - `app.py`: Flask backend for API endpoints (`/api/chat`, `/api/kg/full`).
  - `data/ayurgraph.ttl`: Turtle file containing the Ayurvedic knowledge graph (~190 triples).
- `frontend/`
  - `src/App.jsx`: React component for the chat interface and graph visualization.
  - `src/styles.css`: CSS for styling the frontend.
- `.env`: Environment variables for backend (e.g., `GROQ_API_KEY`) and frontend (e.g., `VITE_API_URL`).

## Prerequisites

- **Python**: 3.8 or higher
- **Node.js**: 18 or higher
- **Git**: For cloning the repository
- A valid **Groq API key** (sign up at [x.ai](https://x.ai/api) to obtain one)

## Installation

### Backend Setup

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd AyurGraph/backend
   ```

2. **Create a Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install rdflib flask flask-cors langchain-groq python-Levenshtein fuzzywuzzy python-dotenv
   ```

4. **Set Up Environment Variables**:
   Create a `.env` file in the `backend/` directory:
   ```env
   GROQ_API_KEY=<your-groq-api-key>
   ```

5. **Verify Knowledge Graph**:
   Ensure `data/ayurgraph.ttl` exists in the `backend/data/` directory. The provided TTL file contains ~190 triples covering herbs, conditions, symptoms, treatments, and doshas.

6. **Run the Backend**:
   ```bash
   python app.py
   ```
   The server should start at `http://127.0.0.1:5000`. Check logs for:
   ```
   INFO:__main__:Loaded triples: ~190
   INFO:__main__:✅ Groq model Gemma2-9b-it initialized
   ```

### Frontend Setup

1. **Navigate to Frontend Directory**:
   ```bash
   cd ../frontend
   ```

2. **Install Dependencies**:
   ```bash
   npm install react react-dom vis-network vis-data lucide-react
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_API_URL=http://127.0.0.1:5000
   ```

4. **Run the Frontend**:
   ```bash
   npm run dev  # For Vite (or `npm start` if using create-react-app)
   ```
   The app should open at `http://localhost:5173` (or `http://localhost:3000` for create-react-app).

### Optional Development Tools

- **Backend**:
  ```bash
  pip install pipdeptree pytest
  ```
- **Frontend**:
  ```bash
  npm install vite eslint eslint-plugin-react eslint-plugin-react-hooks --save-dev
  ```

## Usage

1. **Access the App**:
   Open `http://localhost:5173` in your browser. You’ll see a welcome message and quick question prompts.

2. **Ask Questions**:
   - Type queries like "Herbs for stress relief" or "Remedies for digestion".
   - Click the "Send" button or press Enter.
   - Responses include Ayurvedic advice and, if applicable, a "View Knowledge Graph" button for visualizing related entities.

3. **View Full Knowledge Graph**:
   - Click "View Full KG" in the header to display the entire knowledge graph (~50-60 nodes, ~100-120 edges).
   - Nodes are color-coded (e.g., herbs: green, conditions: red) with labeled edges (e.g., "Recommended For").

4. **Troubleshooting**:
   - **Empty Graph**: If the graph shows no nodes/edges, check backend logs for errors (e.g., missing `rdfs:label` in `ayurgraph.ttl`).
   - **Server Errors**: Ensure the backend is running and `VITE_API_URL` matches the backend URL.
   - **Windows Threading Issues**: If you see `Exception in thread Thread-2 (serve_forever)`, run with:
     ```bash
     python app.py --no-debug
     ```
     or use `reloader_type='stat'`:
     ```python
     app.run(host="0.0.0.0", port=5000, debug=True, reloader_type='stat')
     ```

## API Endpoints

- **POST /api/chat**:
  - Input: `{ "query": "<user question>" }`
  - Output: JSON with response, knowledge graph data, confidence, and timestamp.
  - Example: `curl -X POST http://127.0.0.1:5000/api/chat -H "Content-Type: application/json" -d '{"query": "Herbs for stress"}'`

- **GET /api/kg/full**:
  - Returns the full knowledge graph for visualization.
  - Output: JSON with `nodes` and `edges`.
  - Example: `curl http://127.0.0.1:5000/api/kg/full`

## Knowledge Graph

- **File**: `data/ayurgraph.ttl`
- **Format**: Turtle (RDF)
- **Entities**: Herbs, Conditions, Symptoms, Treatments, Doshas, Compounds, Preparations, Sources
- **Triples**: ~190 (covering relationships like `recommendedFor`, `hasSymptom`, `balancesDosha`)
- **Note**: Ensure all entities have `rdfs:label` for proper visualization. If logs show 275 triples, verify the TTL file used.

## Dependencies

### Backend (Python)
- rdflib
- flask
- flask-cors
- langchain-groq
- python-Levenshtein
- fuzzywuzzy
- python-dotenv

### Frontend (JavaScript/Node.js)
- react
- react-dom
- vis-network
- vis-data
- lucide-react

### Optional Development Tools
- **Backend**: pipdeptree, pytest
- **Frontend**: vite, eslint, eslint-plugin-react, eslint-plugin-react-hooks

## Development Notes

- **Backend**:
  - Uses `rdflib` for SPARQL queries and graph parsing.
  - Integrates with Groq API for LLM responses (model: Gemma2-9b-it).
  - Fuzzy matching (`fuzzywuzzy`) handles query misspellings.
  - Logs errors for debugging (e.g., invalid triples, API failures).

- **Frontend**:
  - Built with Vite/React for fast development.
  - Uses `vis-network` for graph visualization with color-coded nodes and labeled edges.
  - Includes error handling for empty graphs or server issues.

- **Known Issues**:
  - Windows users may encounter `watchdog` threading errors in debug mode. Use `debug=False` or `reloader_type='stat'`.
  - If the knowledge graph appears empty, ensure `ayurgraph.ttl` is valid and contains `rdfs:label` for all entities.

## Testing

1. **Backend**:
   - Run `python app.py` and check logs for triple count and Groq initialization.
   - Test `/api/kg/full` with `curl` or Postman to verify non-empty `nodes` and `edges`.
   - Test `/api/chat` with queries like "herbs for stress" to confirm responses and graph data.

2. **Frontend**:
   - Run `npm run dev` and open the app in a browser.
   - Test quick questions and custom queries.
   - Verify the full knowledge graph loads via the "View Full KG" button.
   - Check browser console for `vis-network` errors.

3. **Validate Triples**:
   ```python
   from rdflib import Graph
   g = Graph()
   g.parse("data/ayurgraph.ttl", format="turtle")
   print(len(g))  # Should match log output (~190 or 275)
   ```

## Contributing

- Submit issues or pull requests to the repository.
- Ensure new triples in `ayurgraph.ttl` include `rdfs:label` and `ayur:description`.
- Add unit tests using `pytest` for backend and `jest` for frontend (if implemented).

## License

This project is for educational purposes and provided as-is. Consult a healthcare professional before applying Ayurvedic remedies.

## Contact

For support, contact the repository maintainers or open an issue.
```
