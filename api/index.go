package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("phone")
	fbKey := os.Getenv("FIREBASE_KEY")

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if phone == "" {
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "API ONLINE"})
		return
	}

	// ✅ Consulta DIRETA e SEGURA — sem erros de caminho
	fbURL := fmt.Sprintf(
		"https://firestore.googleapis.com/v1/projects/projects-general-fed41/databases/(default)/documents/users?key=%s&pageSize=100",
		fbKey,
	)

	resp, err := http.Get(fbURL)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "erro_servidor"})
		return
	}
	defer resp.Body.Close()

	var data struct {
		Documents []struct {
			Fields struct {
				Name struct {StringValue string `json:"stringValue"`} `json:"name"`
				Phone struct {StringValue string `json:"stringValue"`} `json:"phone"`
				ProjectExpiration struct {StringValue string `json:"stringValue"`} `json:"project_expiration"`
				Vip struct {BooleanValue bool `json:"booleanValue"`} `json:"vip"`
			} `json:"fields"`
		} `json:"documents"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "formato_invalido"})
		return
	}

	// ✅ Busca manualmente pelo número correto
	for _, doc := range data.Documents {
		if doc.Fields.Phone.StringValue == phone {
			if doc.Fields.Vip.BooleanValue && doc.Fields.ProjectExpiration.StringValue != "" {
				_ = json.NewEncoder(w).Encode(map[string]string{
					"nome":      doc.Fields.Name.StringValue,
					"expiracao": doc.Fields.ProjectExpiration.StringValue,
					"status":    "ativo",
				})
				return
			}
		}
	}

	// Se não encontrar ou não for VIP
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "bloqueado"})
}
