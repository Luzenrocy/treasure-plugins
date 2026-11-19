#!/usr/bin/env bash
# Lists GHCR package-version metadata for the reset review. It never mutates a
# package, image, tag, or repository.
set -euo pipefail

owner="Luzenrocy"
packages=(
  "treasure-plugins/treasure-plugin-market"
  "treasure-plugins/treasure-plugin-icons"
)

token="${GHCR_CLEANUP_TOKEN:-}"
if [[ -z "$token" ]]; then
  read -r -s -p 'GHCR_CLEANUP_TOKEN (input is hidden): ' token
  printf '\n'
fi
if [[ -z "$token" ]]; then
  echo 'A GHCR_CLEANUP_TOKEN is required.' >&2
  exit 1
fi

for package in "${packages[@]}"; do
  encoded_package=$(jq --null-input --raw-output --arg value "$package" '$value | @uri')
  response_dir=$(mktemp -d)
  trap 'rm -rf "$response_dir"; unset token' EXIT
  page=1
  while :; do
    response_file=$(printf '%s/page-%04d.json' "$response_dir" "$page")
    curl --fail-with-body --silent --show-error \
      --header "Accept: application/vnd.github+json" \
      --header "Authorization: Bearer ${token}" \
      --header "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/users/${owner}/packages/container/${encoded_package}/versions?per_page=100&page=${page}" \
      > "$response_file"

    count=$(jq --exit-status 'if type == "array" then length else empty end' "$response_file")
    if (( count < 100 )); then
      break
    fi
    ((page += 1))
  done

  echo "# ghcr.io/${owner,,}/${package}"
  jq --slurp 'add | map({
        id,
        name,
        tags: (.metadata.container.tags // []),
        created_at,
        updated_at
      })' "$response_dir"/page-*.json
  rm -rf "$response_dir"
  trap 'unset token' EXIT
done

unset token
