package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
)

type FirestoreResult struct {
	Document struct {
		Fields struct {
			Name struct {
				StringValue string `json:"stringValue"`
			} `json:"name"`
			Phone struct {
				StringValue string `json:"stringValue"`
			} `json:"phone"`
			ProjectExpiration struct {
				StringValue string `json:"stringValue"`
			} `json:"project_expiration"`
			Vip struct {
				BooleanValue bool `json:"booleanValue"`
			} `json:"vip"`
		} `json:"fields"`
	} `json:"document"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	phone := r.URL.Query().Get("phone")
	firebaseKey := os.Getenv("FIREBASE_KEY")

	if phone == "" {
		fmt.Fprintf(w, `{"status":"API ONLINE | WCA CONNECT"}`)
		return
	}

	// ✅ Consulta com o ID DO PROJETO CONFIRMADO
	query := fmt.Sprintf(`{"structuredQuery":{"from":[{"collectionId":"users"}],"where":{"fieldFilter":{"field":{"fieldPath":"phone"},"op":"EQUAL","value":{"stringValue":"%s"}}}},"limit":1}}`, phone)
	queryEncoded := url.QueryEscape(query)

	firebaseURL := fmt.Sprintf(
		"https://firestore.googleapis.com/v1/projects/projects-general-fed41/databases/(default)/documents:runQuery?key=%s&query=%s",
		firebaseKey, queryEncoded,
	)

	resp, err := http.Get(firebaseURL)
	if err != nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "erro_servidor"})
		return
	}
	defer resp.Body.Close()

	var results []FirestoreResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "formato_invalido"})
		return
	}

	if len(results) > 0 && results[0].Document.Fields.Name.StringValue != "" {
		dados := results[0].Document.Fields
		if dados.Vip.BooleanValue && dados.ProjectExpiration.StringValue != "" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"nome":      dados.Name.StringValue,
				"expiracao": dados.ProjectExpiration.StringValue,
				"status":    "ativo",
			})
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "bloqueado"})
}
