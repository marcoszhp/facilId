-- Execute somente no banco destinado ao FácilID, após o preparo explícito.
-- Fotos, SVG, PIN e credenciais de aparelho permanecem no armazenamento privado cifrado.
CREATE TABLE IF NOT EXISTS facilid_pessoas (
    cpf CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (cpf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facilid_cartoes (
    emissao_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cpf CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome VARCHAR(100) NOT NULL,
    idade TINYINT UNSIGNED NOT NULL,
    versao TINYINT UNSIGNED NOT NULL,
    rosto_hash VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    digital_template VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    assinatura_svg VARCHAR(300) COLLATE utf8mb4_bin NOT NULL,
    assinatura_digital_orgao VARCHAR(1024) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    estado ENUM('ativo','bloqueado','substituido') NOT NULL,
    ordem BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    cpf_ativo CHAR(11) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN estado = 'ativo' THEN cpf ELSE NULL END) STORED,
    PRIMARY KEY (emissao_id),
    UNIQUE KEY facilid_ordem (ordem),
    UNIQUE KEY facilid_um_cartao_ativo (cpf_ativo),
    KEY facilid_cartoes_cpf (cpf),
    CONSTRAINT facilid_cartoes_pessoa FOREIGN KEY (cpf) REFERENCES facilid_pessoas(cpf),
    CONSTRAINT facilid_idade_valida CHECK (idade <= 130),
    CONSTRAINT facilid_versao_valida CHECK (versao = 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facilid_legados (
    conteudo_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cpf CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    identidade_json LONGTEXT COLLATE utf8mb4_bin NOT NULL,
    PRIMARY KEY (conteudo_hash),
    KEY facilid_legados_cpf (cpf),
    CONSTRAINT facilid_legado_json_valido CHECK (JSON_VALID(identidade_json))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facilid_migracoes (
    fonte_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cartoes_importados INT UNSIGNED NOT NULL,
    legados_importados INT UNSIGNED NOT NULL,
    aplicada_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (fonte_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facilid_atendimentos (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    protocolo CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cpf CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome VARCHAR(100) NOT NULL,
    horario DATETIME(3) NOT NULL,
    status ENUM('agendado','confirmado','concluido') NOT NULL,
    criado_em DATETIME(3) NOT NULL,
    atualizado_em DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY facilid_atendimento_horario (horario),
    UNIQUE KEY facilid_atendimento_protocolo (protocolo),
    KEY facilid_atendimentos_cpf (cpf),
    CONSTRAINT facilid_atendimentos_pessoa FOREIGN KEY (cpf) REFERENCES facilid_pessoas(cpf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facilid_eventos (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    emissao_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cpf CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome VARCHAR(100) NOT NULL,
    tipo ENUM('emissao','bloqueio','substituicao') NOT NULL,
    ocorrido_em DATETIME(3) NOT NULL,
    motivo VARCHAR(160) NOT NULL,
    ordem BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id),
    UNIQUE KEY facilid_eventos_ordem (ordem),
    UNIQUE KEY facilid_evento_transicao (emissao_id, tipo),
    KEY facilid_eventos_cronologia (ocorrido_em, ordem),
    KEY facilid_eventos_cpf (cpf),
    CONSTRAINT facilid_eventos_cartao FOREIGN KEY (emissao_id) REFERENCES facilid_cartoes(emissao_id),
    CONSTRAINT facilid_eventos_pessoa FOREIGN KEY (cpf) REFERENCES facilid_pessoas(cpf)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
