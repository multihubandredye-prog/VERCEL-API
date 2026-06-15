package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
)

// Estrutura exata para ler os dados do Firestore
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
	// Configuração de cabeçalhos essencial
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	phone := r.URL.Query().Get("phone")
	firebaseAPIKey := os.Getenv("FIREBASE_KEY")

	// Resposta padrão quando acessa sem número
	if phone == "" {
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "API ONLINE - WCA"})
		return
	}

	// ✅ CONSULTA SEGURA E OFICIAL
	query := fmt.Sprintf(`{"structuredQuery":{"from":[{"collectionId":"users"}],"where":{"fieldFilter":{"field":{"fieldPath":"phone"},"op":"EQUAL","value":{"stringValue":"%s"}}}},"limit":1}}`, phone)
	queryEncoded := url.QueryEscape(query)

	// ✅ IMPORTANTE: SUBSTITUA AQUI PELO ID EXATO DO SEU PROJETO FIREBASE
	// Para pegar o ID correto: no Firebase → Configurações do Projeto → Geral → ID do Projeto
	firebaseURL := fmt.Sprintf(
		"https://firestore.googleapis.com/v1/projects/SEU_ID_DO_PROJETO_FIREBASE_AQUI/databases/(default)/documents:runQuery?key=%s&query=%s",
		firebaseAPIKey, queryEncoded,
	)

	resp, err := http.Get(firebaseURL)
	if err != nil {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "erro_servidor"})
		return
	}
	defer resp.Body.Close()

	var results []FirestoreResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "formato_invalido"})
		return
	}

	// ✅ Verifica e retorna no formato que o Tasker precisa
	if len(results) > 0 && results[0].Document.Fields.Name.StringValue != "" {
		dados := results[0].Document.Fields
		if dados.Vip.BooleanValue && dados.ProjectExpiration.StringValue != "" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"nome":      dados.Name.StringValue,
				"expiracao": dados.ProjectExpiration.StringValue,
				"status":    "ativo",
			})
			return
		}
	}

	// Se não encontrar ou não for VIP
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "bloqueado"})
}
