# Desafio Backend: Encurtador de Links

## Contexto

Você vai construir o backend de um sistema encurtador de links, semelhante ao Bitly.

Na plataforma, cada usuário tem uma conta e um conjunto de links encurtados. Sempre que alguém acessa um desses links, o dono recebe uma comissão de um parceiro.

O desafio é apenas de backend. Não é preciso construir interface visual: a aplicação deve expor uma API (por exemplo, REST).

---

## Stack

| Item | Definição |
|---|---|
| Linguagem | JavaScript com Node.js |
| TypeScript | Opcional |
| Framework | À sua escolha |
| Persistência | Pode ser local. |

---

## Requisitos obrigatórios

### 1. Cadastro de usuário

Deve ser possível criar um usuário na plataforma.

### 2. Criação de link encurtado associado a um usuário

Um usuário deve conseguir cadastrar uma URL original e receber um link encurtado associado à sua conta.

### 3. Listagem dos links de um usuário

Deve ser possível listar todos os links encurtados de um usuário específico.

### 4. Acesso ao link original a partir do link encurtado

Ao acessar um link encurtado, o sistema deve retornar a URL original ou redirecionar para ela. Cada acesso deve ser registrado como uma visualização.

---

## Bônus (opcional)

### 5. Valor por visualização

Na criação do link encurtado, deve ser informado um valor X, que é o quanto cada visualização daquele link rende ao usuário.

### 6. Ganho mensal do usuário

Deve existir uma funcionalidade que retorne quanto o usuário ganharia no mês, com base nas visualizações dos seus links encurtados e no valor X de cada um.
