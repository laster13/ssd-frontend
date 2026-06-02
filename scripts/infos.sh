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

# Compatibilité SSDv2
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

get_architecture

# ============================================================
# Chemins
# ============================================================

json_file="${HOME}/seedbox/docker/${USER}/projet-ssd/ssd-backend/data/settings.json"

if [[ ! -f "$json_file" ]]; then
    echo "Le fichier $json_file n'existe pas."
    exit 1
fi

json_get() {
    jq -r "$1 // empty" "$json_file"
}

# ============================================================
# Lecture settings.json
# ============================================================

username=$(json_get '.utilisateur.username')
email=$(json_get '.utilisateur.email')
domain=$(json_get '.utilisateur.domain')
password=$(json_get '.utilisateur.password')
domainperso=$(json_get '.utilisateur.domainperso')

cloudflare_login=$(json_get '.cloudflare.cloudflare_login')
cloudflare_api_key=$(json_get '.cloudflare.cloudflare_api_key')

oauth_enabled=$(json_get '.utilisateur.oauth_enabled')
oauth_client=$(json_get '.utilisateur.oauth_client')
oauth_secret=$(json_get '.utilisateur.oauth_secret')
oauth_mail=$(json_get '.utilisateur.oauth_mail')

# ============================================================
# Mise à jour all.yml
# ============================================================

manage_account_yml user.name "$username"
manage_account_yml user.mail "$email"
manage_account_yml user.domain "$domain"
manage_account_yml user.pass "$password"

manage_account_yml user.userid "$SSD_UID"
manage_account_yml user.groupid "$SSD_GID"
manage_account_yml user.group "$USER"

manage_account_yml cloudflare.login "$cloudflare_login"
manage_account_yml cloudflare.api "$cloudflare_api_key"

# ============================================================
# OAuth
# ============================================================

if [[ "$oauth_enabled" == "true" ]]; then
    openssl_secret=$(openssl rand -hex 16)

    manage_account_yml oauth.openssl "$openssl_secret"
    manage_account_yml oauth.client "$oauth_client"
    manage_account_yml oauth.secret "$oauth_secret"
    manage_account_yml oauth.account "$oauth_mail"

    cat > "${SETTINGS_SOURCE}/includes/dockerapps/templates/traefik/run-oauth.yml" <<'EOF'
---
- name: "Wrapper Playbook for OAuth Setup"
  hosts: all
  vars_files:
    - "{{ settings.source }}/includes/dockerapps/templates/generique/generique.yml"
  tasks:
    - name: "Include the OAuth playbook"
      include_tasks: oauth.yml
EOF

    ANSIBLE_ACTION_WARNINGS=False \
    ACTION_WARNINGS=False \
    ANSIBLE_COMMAND_WARNINGS=False \
    ansible-playbook \
        -i "${ANSIBLE_INVENTORY}" \
        --vault-password-file "${ANSIBLE_VAULT_PASSWORD_FILE}" \
        "${SETTINGS_SOURCE}/includes/dockerapps/templates/traefik/run-oauth.yml" \
        2> >(grep -v -E "Using a variable for a task|argsplat|unsafe\)|^\(see$|docs\.ansible\.com" >&2)

    if [[ $? -ne 0 ]]; then
        echo "Erreur lors de la configuration OAuth."
        exit 1
    fi
fi

# ============================================================
# htpasswd
# ============================================================

account_user=$(get_from_account_yml user.name)
account_pass=$(get_from_account_yml user.pass)

if [[ -n "$account_user" && -n "$account_pass" ]]; then
    manage_account_yml user.htpwd "$(htpasswd -nb "$account_user" "$account_pass")"
else
    echo "Attention : user.name ou user.pass est vide, user.htpwd non mis à jour."
fi

echo "Infos mise à jour avec succès."

exit 0