package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Estruturas para mapear o JSON do Firebase
type FirebaseResponse struct {
	Documents []struct {
		Fields struct {
			Phone struct {
				StringValue string `json:"stringValue"`
			} `json:"phone"`
			Name struct {
				StringValue string `json:"stringValue"`
			} `json:"name"`
			ProjectExpiration struct {
				StringValue string `json:"stringValue"`
			} `json:"project_expiration"`
		} `json:"fields"`
	} `json:"documents"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("phone")
	firebaseKey := os.Getenv("FIREBASE_KEY")
	firebaseURL := fmt.Sprintf("https://firestore.googleapis.com/v1/projects/projects-general-fed41/databases/(default)/documents/users?key=%s", firebaseKey)

	// Se não houver telefone, exibe a página HTML elegante
	if phone == "" {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprintf(w, `
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>WHATS-CONNECT-API</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background: #1e293b; padding: 3rem; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; border-bottom: 5px solid #10b981; min-width: 300px; }
                    h2 { margin: 0; color: #f8fafc; letter-spacing: 1px; font-size: 1.5rem; }
                    .status-box { margin-top: 25px; padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 50px; display: inline-block; padding: 10px 25px; }
                    .status-dot { color: #10b981; font-size: 1.2rem; margin-right: 8px; }
                    .info { color: #64748b; font-size: 0.85rem; margin-top: 30px; text-transform: uppercase; letter-spacing: 2px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>WHATS-CONNECT-API</h2>
                    <div class="status-box">
                        <span class="status-dot">●</span> 
                        <span style="color: #10b981; font-weight: 600;">SERVIDOR ATIVO</span>
                    </div>
                    <p class="info">Aguardando Conexão</p>
                </div>
            </body>
            </html>
        `)
		return
	}

	// Consulta ao Firebase
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(firebaseURL)
	if err != nil {
		http.Error(w, "Erro na conexão", 500)
		return
	}
	defer resp.Body.Close()

	var data FirebaseResponse
	json.NewDecoder(resp.Body).Decode(&data)

	// Busca o usuário
	for _, doc := range data.Documents {
		if doc.Fields.Phone.StringValue == phone {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"nome":      doc.Fields.Name.StringValue,
				"expiracao": doc.Fields.ProjectExpiration.StringValue,
				"status":    "ativo",
			})
			return
		}
	}

	// Caso não encontre
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(404)
	json.NewEncoder(w).Encode(map[string]string{"status": "bloqueado"})
}
