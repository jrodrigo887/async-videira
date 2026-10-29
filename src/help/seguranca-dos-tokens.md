---
id: seguranca-dos-tokens
titulo: Segurança dos tokens
publico: operador
categoria: tecnico
ordem: 3
palavras-chave: [segurança, token, senha, vazou, revogar, firewall, rede, cofre]
relacionados: [configurar-holyrics, configurar-videira]
---

O app usa dois tokens. Os dois ficam guardados no **cofre do sistema** deste computador e nunca aparecem em arquivos ou relatórios.

| Token | O que ele permite |
|---|---|
| Holyrics | mexer na playlist do culto, pela rede local |
| Videira Music | ler os setlists publicados da igreja e enviar os avisos de resultado |

## Boas práticas

- **Nunca cole** nenhum dos dois em conversas, e-mails, prints ou documentos compartilhados.
- **Troque os tokens** quando um voluntário sair da equipe ou quando um token aparecer onde não devia.
- No token do Holyrics, mantenha **só as permissões mínimas**. Se um dia precisar de outra, adicione só ela.
- Mantenha o **firewall do Windows ligado** no computador do Holyrics. Não libere a porta 8091 para a rede ou para a internet.
- Antes de uma mudança grande, teste numa playlist de teste.

> A API do Holyrics escuta em todas as redes do computador. Qualquer aparelho da mesma rede que descubra o token consegue usá-la. Se a rede da igreja é aberta ao público, isso importa ainda mais.

O arquivo de estado do app **não contém tokens**. Se um dia encontrar um token nele, trate como falha e avise a equipe.
