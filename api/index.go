package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
)

type FirebaseResponse struct {
	Document struct {
		Fields struct {
			Name              struct{ StringValue string `json:"name"` } `json:"name"`
			ProjectExpiration struct{ StringValue string `json:"project_expiration"` } `json:"project_expiration"`
			Vip               struct{ BooleanValue bool `json:"vip"` } `json:"vip"`
		} `json:"fields"`
	} `json:"document"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("phone")
	firebaseKey := os.Getenv("FIREBASE_KEY")

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	// Página inicial quando sem número
	if phone == "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, `
<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>WHATS-CONNECT-API</title><style>body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; } .card { background: #1e293b; padding: 3rem; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; border-bottom: 5px solid #10b981; } h2 { margin: 0; color: #f8fafc; font-size: 1.5rem; letter-spacing: 1px; } .status-box { margin-top: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 50px; display: inline-block; padding: 10px 25px; } .status-dot { color: #10b981; margin-right: 8px; font-size: 1.2rem; } .info { color: #64748b; font-size: 0.85rem; margin-top: 30px; text-transform: uppercase; letter-spacing: 2px; }</style></head><body><div class="card"><h2>WHATS-CONNECT-API</h2><div class="status-box"><span class="status-dot">●</span><span style="color: #10b981; font-weight: 600;">SERVIDOR ATIVO</span></div><p class="info">Aguardando Conexão</p></div></body></html>
		`)
		return
	}

	// Consulta adaptada aos seus campos
	query := fmt.Sprintf(`{"structuredQuery":{"from":[{"collectionId":"users"}],"where":{"fieldFilter":{"field":{"fieldPath":"phone"},"op":"EQUAL","value":{"stringValue":"%s"}}}},"limit":1}}`, phone)
	queryEncoded := url.QueryEscape(query)

	firebaseURL := fmt.Sprintf(
		"https://firestore.googleapis.com/v1/projects/projects-general-fed41/databases/(default)/documents:runQuery?key=%s&query=%s",
		firebaseKey, queryEncoded,
	)

	resp, err := http.Get(firebaseURL)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "erro_servidor"})
		return
	}
	defer resp.Body.Close()

	var result []FirebaseResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "formato_invalido"})
		return
	}

	// Verifica se encontrou e retorna no formato que o código Tasker espera
	if len(result) > 0 && result[0].Document.Fields.Name.StringValue != "" {
		expDate := result[0].Document.Fields.ProjectExpiration.StringValue
		name := result[0].Document.Fields.Name.StringValue
		// Se tem vip=true → retorna como ativo
		if result[0].Document.Fields.Vip.BooleanValue {
			_ = json.NewEncoder(w).Encode(map[string]string{
				"nome":      name,
				"expiracao": expDate,
				"status":    "ativo",
			})
			return
		}
	}

	// Se não encontrar ou não for VIP
	w.WriteHeader(http.StatusNotFound)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "bloqueado"})
}
