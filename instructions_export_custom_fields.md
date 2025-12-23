# export_custom_fields.md

## Overview

Export Frappe customizations (custom fields, scripts, property setters) to version control.

## Core features

- Export Custom Fields to module directory
- Export Server Scripts to fixtures
- Export Client Scripts to fixtures
- Export Property Setters to module directory
- Export Custom HTML Blocks to fixtures
- Bulk export from Customize Form

## Export paths

- Custom fields: `{app}/{module}/custom/{doctype}.json`
- Scripts: `{app}/fixtures/{script_type}.json`
- Property setters: Included in custom field exports

## Usage

- Navigate to Custom Field/Server Script/Client Script form
- Click "Export to Module" button (visible in developer mode)
- Files export to app directory structure
- Commit to version control

## Requirements

- Developer mode must be enabled
- Module assignment required
- Frappe Framework v15+
