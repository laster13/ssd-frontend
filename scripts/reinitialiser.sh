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

# ============================================================
# Variables
# ============================================================

line="$1"

if [[ -z "$line" ]]; then
    echo "Erreur : veuillez fournir le nom du container à réinitialiser."
    exit 1
fi

# ============================================================
# Réinitialisation
# ============================================================

log_write "Reinit du container ${line}" >/dev/null 2>&1

echo -e "\e[32m$(gettext "Les volumes ne seront pas supprimés")\e[0m"

# Suppression container
docker rm -f "${line}" >/dev/null 2>&1 || true

# Nettoyage images/cache inutilisés
docker system prune -af

if [[ "${line}" == "zurg" ]]; then
    launch_service "${line}"

    ANSIBLE_ACTION_WARNINGS=False \
    ACTION_WARNINGS=False \
    ANSIBLE_COMMAND_WARNINGS=False \
    ansible-playbook \
        -i "${ANSIBLE_INVENTORY}" \
        --vault-password-file "${ANSIBLE_VAULT_PASSWORD_FILE}" \
        "${SETTINGS_SOURCE}/includes/config/roles/rclone/tasks/main.yml" \
        2> >(grep -v -E "Using a variable for a task|argsplat|unsafe\)|^\(see$|docs\.ansible\.com" >&2)
else
    "${HOME}/seedbox/docker/${USER}/projet-ssd/ssd-frontend/scripts/appli.sh" "${line}"
fi

exit 0