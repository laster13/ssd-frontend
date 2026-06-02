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
# Suppression application
# ============================================================

line="$1"

if [[ -z "$line" ]]; then
    echo "Erreur : veuillez fournir le nom de l'application à supprimer."
    exit 1
fi

suppression_appli "${line}" 1

exit 0