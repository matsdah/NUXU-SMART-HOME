export type ActionParamType = "string" | "integer" | "number" | "boolean";

export type ActionParamSchema = {
    name: string;
    type: ActionParamType;
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
    enum?: string[];
    label?: string;
};

export type ActionSchema = {
    actionName: string;
    params: ActionParamSchema[];
};

export type DeviceTypeWithActions = {
    id?: string;
    name?: string;
    actions?: Array<{
        name?: string;
        params?: Array<{ name?: string; type?: string }>;
    }>;
};

export type ActionItem = {
    actionName: string;
    params: Record<string, unknown>;
};

export type ActionRowError = {
    index: number;
    field?: string;
    message: string;
};

const ACTION_PARAM_OVERRIDES: Record<string, Array<Partial<ActionParamSchema>>> = {
    setTemperature: [{ min: 18, max: 38, step: 1, label: "Temperatura" }],
    setBrightness: [{ min: 0, max: 100, step: 5, label: "Brillo" }],
    setVolume: [{ min: 0, max: 10, step: 1, label: "Volumen" }],
    setLevel: [{ min: 0, max: 100, step: 5, label: "Nivel" }],
    setFreezerTemperature: [
        { min: -20, max: -8, step: 1, label: "Temperatura freezer" },
    ],
    setHeat: [{ min: 90, max: 230, step: 5, label: "Temperatura" }],
    setGrill: [{ min: 90, max: 230, step: 5, label: "Temperatura" }],
    setConvection: [{ min: 90, max: 230, step: 5, label: "Temperatura" }],
    dispense: [
        { min: 1, max: 100, step: 5, label: "Cantidad" },
        { enum: ["ml", "cl", "dl", "l"], label: "Unidad" },
    ],
    setFanSpeed: [
        {
            enum: ["auto", "25%", "50%", "75%", "100%"],
            label: "Velocidad",
        },
    ],
    setVerticalSwing: [
        {
            enum: ["auto", "22°", "45°", "67°", "90°"],
            label: "Oscilacion vertical",
        },
    ],
    setHorizontalSwing: [
        {
            enum: ["auto", "-90°", "-45°", "0°", "45°"],
            label: "Oscilacion horizontal",
        },
    ],
    setGenre: [
        {
            enum: ["clasica", "country", "dance", "latina", "pop", "rock"],
            label: "Genero",
        },
    ],
};

const ACTION_PARAM_OVERRIDES_BY_TYPE: Record<
    string,
    Record<string, Array<Partial<ActionParamSchema>>>
> = {
    "aire acondicionado": {
        setMode: [{ enum: ["fan", "cool", "heat"], label: "Modo" }],
    },
    "air conditioner": {
        setMode: [{ enum: ["fan", "cool", "heat"], label: "Modo" }],
    },
    ac: {
        setMode: [{ enum: ["fan", "cool", "heat"], label: "Modo" }],
    },
    heladera: {
        setMode: [
            { enum: ["normal", "party", "vacation"], label: "Modo" },
        ],
    },
    fridge: {
        setMode: [
            { enum: ["normal", "party", "vacation"], label: "Modo" },
        ],
    },
    refrigerator: {
        setMode: [
            { enum: ["normal", "party", "vacation"], label: "Modo" },
        ],
    },
    aspiradora: {
        setMode: [{ enum: ["vacuum", "mop"], label: "Modo" }],
    },
    vacuum: {
        setMode: [{ enum: ["vacuum", "mop"], label: "Modo" }],
    },
};

const PARAM_TYPE_MAP: Record<string, ActionParamType> = {
    string: "string",
    integer: "integer",
    number: "number",
    boolean: "boolean",
};

function normalizeTypeName(typeName: string): string {
    return typeName.trim().toLowerCase();
}

function normalizeParamType(raw: string | undefined): ActionParamType {
    if (!raw) return "string";
    const key = raw.toLowerCase();
    return PARAM_TYPE_MAP[key] ?? "string";
}

export function buildDeviceTypeActionMap(
    deviceTypes: DeviceTypeWithActions[],
): Record<string, ActionSchema[]> {
    const map: Record<string, ActionSchema[]> = {};

    for (const deviceType of deviceTypes) {
        if (!deviceType.name) continue;
        const typeKey = normalizeTypeName(deviceType.name);
        const actions = (deviceType.actions ?? []).reduce<ActionSchema[]>(
            (acc, action) => {
                if (!action.name) return acc;
                const params = (action.params ?? []).map((param, index) => {
                    const base: ActionParamSchema = {
                        name: param.name?.trim() || `param${index + 1}`,
                        type: normalizeParamType(param.type),
                        required: true,
                    };
                    return applyParamOverride(action.name, base, index);
                });
                acc.push({ actionName: action.name, params });
                return acc;
            },
            [],
        );

        map[typeKey] = actions;
    }

    return map;
}

export function getParamSchemaForAction(
    deviceTypeName: string | undefined,
    actionName: string,
    schemaMap: Record<string, ActionSchema[]>,
): ActionParamSchema[] {
    if (!actionName) return [];
    const key = deviceTypeName ? normalizeTypeName(deviceTypeName) : "";
    const typeActions = key ? schemaMap[key] : undefined;

    const fromType = typeActions?.find(
        (action) => action.actionName === actionName,
    );
    if (fromType) return fromType.params;

    const typeOverrides = key
        ? ACTION_PARAM_OVERRIDES_BY_TYPE[key]?.[actionName]
        : undefined;
    const overrides =
        typeOverrides ?? ACTION_PARAM_OVERRIDES[actionName] ?? null;

    if (!overrides) return [];
    return overrides.map((override, index) =>
        applyParamOverride(actionName, {
            name: `param${index + 1}`,
            type: override.enum ? "string" : "number",
            required: true,
        }, index),
    );
}

export function applyParamOverride(
    actionName: string,
    base: ActionParamSchema,
    index: number,
): ActionParamSchema {
    const overrides = ACTION_PARAM_OVERRIDES[actionName]?.[index];
    if (!overrides) return base;
    return { ...base, ...overrides };
}

export function buildDefaultParams(schema: ActionParamSchema[]): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    for (const param of schema) {
        if (param.enum && param.enum.length > 0) {
            params[param.name] = param.enum[0];
            continue;
        }
        if (param.type === "boolean") {
            params[param.name] = false;
            continue;
        }
        if (param.type === "integer" || param.type === "number") {
            params[param.name] =
                typeof param.min === "number" ? param.min : 0;
            continue;
        }
        params[param.name] = "";
    }
    return params;
}

export function mapParamsToArray(
    params: Record<string, unknown>,
    schema: ActionParamSchema[],
): Array<string | number | boolean> {
    if (!schema.length) {
        return Object.values(params) as Array<string | number | boolean>;
    }
    return schema.map(
        (param) => params[param.name] as string | number | boolean,
    );
}

export function mapParamsFromApi(
    raw: unknown,
    schema: ActionParamSchema[],
): Record<string, unknown> {
    if (raw && Array.isArray(raw)) {
        const mapped: Record<string, unknown> = {};
        if (schema.length === 0) {
            raw.forEach((value, index) => {
                mapped[`param${index + 1}`] = value;
            });
            return mapped;
        }
        schema.forEach((param, index) => {
            mapped[param.name] = raw[index];
        });
        return mapped;
    }

    if (raw && typeof raw === "object") {
        const record = raw as Record<string, unknown>;
        if (!schema.length) return { ...record };

        const values = Object.values(record);
        const mapped: Record<string, unknown> = {};
        schema.forEach((param, index) => {
            mapped[param.name] = values[index];
        });
        return mapped;
    }

    return {};
}

export function validateActionItem(
    actionName: string,
    params: Record<string, unknown>,
    schema: ActionParamSchema[],
): { valid: boolean; errors: Array<{ field?: string; message: string }> } {
    const errors: Array<{ field?: string; message: string }> = [];

    if (!actionName) {
        errors.push({ field: "actionName", message: "Selecciona una accion." });
    }

    for (const param of schema) {
        const value = params[param.name];
        const label = param.label ?? param.name;
        const isRequired = param.required !== false;

        if (value === "" || value === undefined || value === null) {
            if (isRequired) {
                errors.push({
                    field: param.name,
                    message: `Completa ${label.toLowerCase()}.`,
                });
            }
            continue;
        }

        if (param.type === "boolean") {
            if (typeof value !== "boolean") {
                errors.push({
                    field: param.name,
                    message: `${label} debe ser verdadero o falso.`,
                });
            }
            continue;
        }

        if (param.type === "integer" || param.type === "number") {
            const numericValue = Number(value);
            if (Number.isNaN(numericValue)) {
                errors.push({
                    field: param.name,
                    message: `${label} debe ser un numero.`,
                });
                continue;
            }
            if (param.type === "integer" && !Number.isInteger(numericValue)) {
                errors.push({
                    field: param.name,
                    message: `${label} debe ser un numero entero.`,
                });
            }
            if (
                typeof param.min === "number" &&
                numericValue < param.min
            ) {
                errors.push({
                    field: param.name,
                    message: `${label} debe ser >= ${param.min}.`,
                });
            }
            if (
                typeof param.max === "number" &&
                numericValue > param.max
            ) {
                errors.push({
                    field: param.name,
                    message: `${label} debe ser <= ${param.max}.`,
                });
            }
            continue;
        }

        if (param.enum && !param.enum.includes(String(value))) {
            errors.push({
                field: param.name,
                message: `${label} debe ser una opcion valida.`,
            });
            continue;
        }

        if (isRequired && String(value).trim() === "") {
            errors.push({
                field: param.name,
                message: `Completa ${label.toLowerCase()}.`,
            });
        }
    }

    return { valid: errors.length === 0, errors };
}

export function validateActionsForDevice(
    actions: ActionItem[],
    getSchema: (actionName: string) => ActionParamSchema[],
    options?: { disallowDuplicateActions?: boolean },
): ActionRowError[] {
    const errors: ActionRowError[] = [];
    const disallowDuplicates = options?.disallowDuplicateActions ?? false;

    actions.forEach((action, index) => {
        const schema = getSchema(action.actionName);
        const result = validateActionItem(
            action.actionName,
            action.params,
            schema,
        );
        result.errors.forEach((error) => {
            errors.push({ index, field: error.field, message: error.message });
        });
    });

    if (disallowDuplicates) {
        const seen = new Map<string, number[]>();
        actions.forEach((action, index) => {
            if (!action.actionName) return;
            const list = seen.get(action.actionName) ?? [];
            list.push(index);
            seen.set(action.actionName, list);
        });
        for (const [actionName, indices] of seen.entries()) {
            if (indices.length <= 1) continue;
            indices.forEach((index) => {
                errors.push({
                    index,
                    field: "actionName",
                    message: `La accion ${actionName} ya fue agregada.`,
                });
            });
        }
    }

    return errors;
}

export function validateRoutineActions(
    selectedDeviceIds: string[],
    actionsByDevice: Record<string, ActionItem[]>,
    getSchema: (deviceId: string, actionName: string) => ActionParamSchema[],
    options?: { disallowDuplicateActions?: boolean },
): Record<string, ActionRowError[]> {
    const errorsByDevice: Record<string, ActionRowError[]> = {};

    for (const deviceId of selectedDeviceIds) {
        const actions = actionsByDevice[deviceId] ?? [];
        const errors = validateActionsForDevice(
            actions,
            (actionName) => getSchema(deviceId, actionName),
            options,
        );
        if (errors.length > 0) {
            errorsByDevice[deviceId] = errors;
        }
    }

    return errorsByDevice;
}
