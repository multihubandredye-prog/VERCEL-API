package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
)

type FirestoreDoc struct {
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
}

func Handler(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("phone")
	fbKey := os.Getenv("FIREBASE_KEY")

	// Cabeçalhos obrigatórios
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if phone == "" {
		fmt.Fprintf(w, `{"status":"API ONLINE"}`)
		return
	}

	// ✅ Consulta direta e segura
	query := fmt.Sprintf(`{"structuredQuery":{"from":[{"collectionId":"users"}],"where":{"fieldFilter":{"field":{"fieldPath":"phone"},"op":"EQUAL","value":{"stringValue":"%s"}}}},"limit":1}}`, phone)
	queryEsc := url.QueryEscape(query)

	// ✅ Substitua AQUI o ID do seu projeto se precisar confirmar
	fbURL := fmt.Sprintf(
		"https://firestore.googleapis.com/v1/projects/projects-general-fed41/databases/(default)/documents:runQuery?key=%s&query=%s",
		fbKey, queryEsc,
	)

	resp, err := http.Get(fbURL)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"status":"erro_servidor"})
		return
	}
	defer resp.Body.Close()

	var result []struct {
		Document FirestoreDoc `json:"document"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"status":"formato_invalido"})
		return
	}

	// ✅ Verifica se encontrou e converte
	if len(result) > 0 && result[0].Document.Fields.Name.StringValue != "" {
		dados := result[0].Document.Fields
		if dados.Vip.BooleanValue && dados.ProjectExpiration.StringValue != "" {
			_ = json.NewEncoder(w).Encode(map[string]string{
				"nome":      dados.Name.StringValue,
				"expiracao": dados.ProjectExpiration.StringValue,
				"status":    "ativo",
			})
			return
		}
	}

	// Se não encontrar ou não for VIP
	w.WriteHeader(http.StatusNotFound)
	_ = json.NewEncoder(w).Encode(map[string]string{"status":"bloqueado"})
}

func main() {}
