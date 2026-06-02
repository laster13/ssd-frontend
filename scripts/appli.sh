#!/bin/bash

set -o pipefail

# ============================================================
# Variables obligatoires runtime
# ============================================================

if [[ -z "${SSD_USER:-}" ]]; then
    echo "Erreur : SSD_USER doit être défini."
    exit 1
fi

if [[ -z "${SSD_UID:-}" ]]; then
    echo "Erreur : SSD_UID doit être défini."
    exit 1
fi

if [[ -z "${SSD_GID:-}" ]]; then
    echo "Erreur : SSD_GID doit être défini."
    exit 1
fi

export USER="${SSD_USER}"
export HOME="/home/${SSD_USER}"

export username="${username:-${USER}}"
export user="${user:-${USER}}"
export ansible_user="${ansible_user:-${USER}}"

# Compatibilité SSDv2 : generique.yml utilise MYUID/MYGID
export MYUID="${MYUID:-${SSD_UID}}"
export MYGID="${MYGID:-${SSD_GID}}"

export SETTINGS_SOURCE="${SETTINGS_SOURCE:-/home/${USER}/seedbox-compose}"
export SETTINGS_STORAGE="${SETTINGS_STORAGE:-/home/${USER}/seedbox}"

export ANSIBLE_VARS="${ANSIBLE_VARS:-/home/${USER}/.ansible/inventories/group_vars/all.yml}"
export ANSIBLE_INVENTORY="${ANSIBLE_INVENTORY:-/home/${USER}/.ansible/inventories/local}"
export ANSIBLE_VAULT_PASSWORD_FILE="${ANSIBLE_VAULT_PASSWORD_FILE:-/home/${USER}/.vault_pass}"

export ANSIBLE_PYTHON_INTERPRETER="${ANSIBLE_PYTHON_INTERPRETER:-/usr/local/bin/python3}"
export ANSIBLE_LOCALHOST_WARNING=False
export ANSIBLE_INVENTORY_UNPARSED_WARNING=False
export ANSIBLE_ACTION_WARNINGS=False
export ACTION_WARNINGS=False
export ANSIBLE_COMMAND_WARNINGS=False

mkdir -p "${SETTINGS_SOURCE}/logs"
touch "${SETTINGS_SOURCE}/logs/seedbox.log"

source "${SETTINGS_SOURCE}/profile.sh"
source "${SETTINGS_SOURCE}/includes/functions.sh"

# ============================================================
# Chemins et variables
# ============================================================

json_file="${HOME}/seedbox/docker/${USER}/projet-ssd/ssd-backend/data/settings.json"
line=$1
error=0

# ============================================================
# Fonctions
# ============================================================

extract_domaine_auth() {
    local line="$1"

    if [[ ! -f "$json_file" ]]; then
        echo "Erreur : fichier settings introuvable : $json_file"
        error=1
        return 1
    fi

    auth=$(jq -r --arg line "$line" '.dossiers.authentification[$line] // "empty"' "$json_file")
    domaine=$(jq -r --arg line "$line" '.dossiers.domaine[$line] // ""' "$json_file")

    echo "Authentification : $auth"
    echo "Domaine : $domaine"
}

configure_plex() {
    token=$(jq -r '.plex.token // empty' "$json_file")
    ident=$(jq -r '.plex.login // empty' "$json_file")
    sesame=$(jq -r '.plex.password // empty' "$json_file")

    defaults=(
        "token:default-token"
        "ident:default-ident"
        "sesame:default-sesame"
    )

    plex_configs=(
        "open_main_ports:yes"
        "open_extra_ports:yes"
        "force_auto_adjust_quality:no"
        "force_high_output_bitrates:no"
        "db_cache_size:1000000"
        "transcodes:/mnt/transcodes"
    )

    for item in "${defaults[@]}"; do
        key="${item%%:*}"
        default_value="${item##*:}"

        value=$(eval echo \$$key)
        value="${value:-$default_value}"

        if [[ "$value" == "$default_value" ]]; then
            echo "Info: ${key^} Plex par défaut utilisé (Aucune valeur trouvée)"
        else
            echo "Info: ${key^} Plex trouvé"
        fi

        manage_account_yml "plex.$key" "$value"
    done

    for config in "${plex_configs[@]}"; do
        key="${config%%:*}"
        value="${config##*:}"

        manage_account_yml "plex.$key" "$value"
    done
}

run_playbook() {
    local line="$1"
    local vars_file=""

    if [[ -f "${SETTINGS_STORAGE}/vars/${line}.yml" ]]; then
        vars_file="${SETTINGS_STORAGE}/vars/${line}.yml"
    elif [[ -f "${SETTINGS_SOURCE}/includes/dockerapps/vars/${line}.yml" ]]; then
        vars_file="${SETTINGS_SOURCE}/includes/dockerapps/vars/${line}.yml"
    else
        log_write "Aucun fichier de configuration trouvé dans les sources, abandon"
        error=1
        return 1
    fi

    ANSIBLE_ACTION_WARNINGS=False \
    ACTION_WARNINGS=False \
    ANSIBLE_COMMAND_WARNINGS=False \
    ansible-playbook \
        -i "${ANSIBLE_INVENTORY}" \
        --vault-password-file "${ANSIBLE_VAULT_PASSWORD_FILE}" \
        "${SETTINGS_SOURCE}/includes/dockerapps/vars/generique.yml" \
        --extra-vars "@${vars_file}" \
        2> >(grep -v -E "Using a variable for a task|argsplat|unsafe\)|^\(see$|docs\.ansible\.com" >&2)

    if [[ $? -ne 0 ]]; then
        error=1
        return 1
    fi
}

install_application() {
    local line="$1"

    extract_domaine_auth "$line"

    if [[ $error -ne 0 ]]; then
        echo "Erreur lors de l'installation de ${line}."
        return 1
    fi

    manage_account_yml sub.${line}.${line} "$domaine"
    manage_account_yml sub.${line}.auth "$auth"

    case "$line" in
        "plex")
            configure_plex
            run_playbook "$line"
            ;;
        *)
            run_playbook "$line"
            ;;
    esac

    if [[ "$line" != "stream-fusion" && $error -eq 0 ]]; then
        echo "Installation de ${line} terminée avec succès."
    elif [[ "$line" == "stream-fusion" ]]; then
        echo "Déploiement de stream-fusion terminé avec succès via Docker Compose."
    else
        echo "Erreur lors de l'installation de ${line}."
    fi
}

# ============================================================
# Exécution
# ============================================================

if [[ -z "$line" ]]; then
    echo "Erreur : veuillez fournir un argument (plex, stream-fusion, ou autre application générique)."
    exit 1
fi

install_application "$line"

exit 0