# Permissões

Todas as permissões de um grupo, por seção. Como elas se combinam está em [Permissões e cargos](/guia/permissoes).

## Gerenciamento (`manage`)

Valem para o grupo todo; nenhuma sala sobrescreve.

| Chave | Nome na interface | Libera | Padrão @everyone |
|---|---|---|---|
| `administrator` | Administrador | **Tudo**, em todas as salas, ignorando exceções. | ❌ |
| `manageGroup` | Gerenciar grupo | Nome, ícone, descrição, tema, mapa, link personalizado, todos os convites. | ❌ |
| `manageChannels` | Gerenciar salas | Criar, renomear, apagar e reordenar salas e categorias; permissões das salas. | ❌ |
| `manageRoles` | Gerenciar cargos | Criar/editar/apagar cargos abaixo do seu, dar cargos, permissões do @everyone. | ❌ |
| `kickMembers` | Expulsar membros | Tirar alguém do grupo. | ❌ |
| `banMembers` | Banir membros | Banir e desbanir; ver a lista de banidos. | ❌ |
| `manageMessages` | Gerenciar mensagens | Apagar mensagens dos outros. | ❌ |
| `manageReactions` | Gerenciar reações | Tirar a reação dos outros de uma mensagem. | ❌ |
| `createInvites` | Criar convites | Criar convites e revogar os seus. | ❌ |
| `manageWebhooks` | Gerenciar webhooks | Criar, editar e apagar os [webhooks](/guia/webhooks) das salas que vê, e ver os endereços deles. | ❌ |

## Geral (`general`)

Valem para salas de texto e de voz; a sala pode sobrescrever.

| Chave | Libera | Padrão @everyone |
|---|---|---|
| `viewChannel` | Ver a sala. Sem isso, a sala nem aparece (e o bot não recebe as mensagens dela). | ✅ |

## Texto (`text`)

Só para salas de texto; a sala pode sobrescrever.

| Chave | Libera | Padrão @everyone |
|---|---|---|
| `sendMessages` | Enviar mensagens (e o "digitando..."). | ✅ |
| `sendGifs` | Enviar GIFs. | ✅ |
| `sendImages` | Enviar imagens. | ✅ |
| `mentionMembers` | Mencionar pessoas com notificação. Sem isso a menção aparece, mas não notifica. | ✅ |
| `mentionEveryone` | Usar `@everyone`, `@online`, `@offline`, `!` nas combinações, e mencionar qualquer cargo. | ❌ |
| `addReactions` | Colocar um emoji **novo** numa mensagem. | ✅ |
| `react` | Entrar numa reação que já existe. | ✅ |

## Voz (`voice`)

Só para salas de voz. Bots não entram em chamadas; listadas para quem gerencia cargos.

| Chave | Libera | Padrão @everyone |
|---|---|---|
| `connect` | Entrar na sala de voz. | ✅ |
| `mic` | Falar. | ✅ |
| `screen` | Compartilhar a tela. | ✅ |
| `camera` | Ligar a câmera. | ✅ |
| `videoSource` | Colocar vídeos (YouTube etc.) para todos. | ✅ |
| `chat` | Escrever no chat da chamada. | ✅ |
| `gif` | GIFs no chat da chamada. | ✅ |
| `image` | Imagens no chat da chamada. | ✅ |

## Quem pode o quê, além das chaves

| Ação | Regra |
|---|---|
| Apagar a própria mensagem | Sempre. |
| Tirar a própria reação | Sempre. |
| Sair do grupo | Sempre (menos o dono). |
| Mudar visibilidade, transferir, apagar o grupo | Só o **dono**. |
| Expulsar/banir/dar cargo a alguém | Precisa ter cargo **acima** do da pessoa. Ninguém age sobre o dono. |
| Editar/apagar/reordenar um cargo | Só cargos **abaixo** do seu. |
| Ligar uma permissão num cargo | Só permissões que você mesmo tem (administradores podem todas). |
