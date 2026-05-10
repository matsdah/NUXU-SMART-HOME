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
    maxLength?: number;
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
        params?: Array<{
            name?: string;
            type?: string;
            minValue?: number | string;
            maxValue?: number | string;
            supportedValues?: string[];
        }>;
        return?: {
            type?: string;
            description?: string;
            example?: unknown;
        };
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
    setTemperature: [
        { name: "temperature", type: "integer", min: 18, max: 38, step: 1, label: "Temperatura" },
    ],
    setBrightness: [
        { name: "brightness", type: "integer", min: 0, max: 100, step: 1, label: "Brillo" },
    ],
    setColor: [
        { name: "color", type: "string", label: "Color" },
    ],
    setVolume: [
        { name: "volume", type: "integer", min: 0, max: 10, step: 1, label: "Volumen" },
    ],
    setLevel: [
        { name: "level", type: "integer", min: 0, max: 100, step: 1, label: "Nivel" },
    ],
    setFreezerTemperature: [
        { name: "temperature", type: "integer", min: -20, max: -8, step: 1, label: "Temperatura freezer" },
    ],
    setHeat: [
        { name: "heat", type: "string", enum: ["conventional", "bottom", "top"], label: "Calor" },
    ],
    setGrill: [
        { name: "grill", type: "string", enum: ["large", "eco", "off"], label: "Grill" },
    ],
    setConvection: [
        { name: "convection", type: "string", enum: ["normal", "eco", "off"], label: "Conveccion" },
    ],
    dispense: [
        { name: "quantity", type: "integer", min: 1, max: 100, step: 1, label: "Cantidad" },
        { name: "unit", type: "string", enum: ["ml", "cl", "dl", "l", "dal", "hl", "kl"], label: "Unidad" },
    ],
    setFanSpeed: [
        {
            name: "fanSpeed",
            type: "string",
            enum: ["auto", "25", "50", "75", "100"],
            label: "Velocidad",
        },
    ],
    setVerticalSwing: [
        {
            name: "verticalSwing",
            type: "string",
            enum: ["auto", "22", "45", "67", "90"],
            label: "Oscilacion vertical",
        },
    ],
    setHorizontalSwing: [
        {
            name: "horizontalSwing",
            type: "string",
            enum: ["auto", "-90", "-45", "0", "45", "90"],
            label: "Oscilacion horizontal",
        },
    ],
    setGenre: [
        {
            name: "genre",
            type: "string",
            enum: ["classical", "country", "dance", "latina", "pop", "rock"],
            label: "Genero",
        },
    ],
    changeSecurityCode: [
        { name: "oldSecurityCode", type: "string", label: "Codigo actual" },
        { name: "newSecurityCode", type: "string", label: "Codigo nuevo" },
    ],
    armStay: [
        { name: "securityCode", type: "string", label: "Codigo de seguridad", maxLength: 4 },
    ],
    armAway: [
        { name: "securityCode", type: "string", label: "Codigo de seguridad", maxLength: 4 },
    ],
    disarm: [
        { name: "securityCode", type: "string", label: "Codigo de seguridad", maxLength: 4 },
    ],
    setLocation: [
        { name: "roomId", type: "string", label: "Habitacion" },
    ],
};

const ACTION_PARAM_OVERRIDES_BY_TYPE: Record<
    string,
    Record<string, Array<Partial<ActionParamSchema>>>
> = {
    "aire acondicionado": {
        setMode: [{ name: "mode", type: "string", enum: ["cool", "heat", "fan"], label: "Modo" }],
    },
    "air conditioner": {
        setMode: [{ name: "mode", type: "string", enum: ["cool", "heat", "fan"], label: "Modo" }],
    },
    ac: {
        setMode: [{ name: "mode", type: "string", enum: ["cool", "heat", "fan"], label: "Modo" }],
    },
    heladera: {
        setMode: [
            { name: "mode", type: "string", enum: ["default", "vacation", "party"], label: "Modo" },
        ],
        setTemperature: [
            { name: "temperature", type: "integer", min: 2, max: 8, step: 1, label: "Temperatura" },
        ],
    },
    fridge: {
        setMode: [
            { name: "mode", type: "string", enum: ["default", "vacation", "party"], label: "Modo" },
        ],
        setTemperature: [
            { name: "temperature", type: "integer", min: 2, max: 8, step: 1, label: "Temperatura" },
        ],
    },
    refrigerator: {
        setMode: [
            { name: "mode", type: "string", enum: ["default", "vacation", "party"], label: "Modo" },
        ],
        setTemperature: [
            { name: "temperature", type: "integer", min: 2, max: 8, step: 1, label: "Temperatura" },
        ],
    },
    aspiradora: {
        setMode: [{ name: "mode", type: "string", enum: ["vacuum", "mop"], label: "Modo" }],
    },
    vacuum: {
        setMode: [{ name: "mode", type: "string", enum: ["vacuum", "mop"], label: "Modo" }],
    },
    oven: {
        setTemperature: [
            { name: "temperature", type: "integer", min: 90, max: 230, step: 1, label: "Temperatura" },
        ],
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

function normalizeEnum(values: unknown): string[] | undefined {
    if (!Array.isArray(values)) return undefined;
    const cleaned = values.filter((value): value is string => typeof value === "string" && value.length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeNumericConstraint(
    raw: number | string | undefined,
    type: ActionParamType,
): number | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (type !== "integer" && type !== "number") return undefined;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    return undefined;
}

function mergeParamOverride(
    base: ActionParamSchema,
    overrides?: Partial<ActionParamSchema>,
): ActionParamSchema {
    if (!overrides) return base;
    return {
        ...base,
        ...overrides,
        required: overrides.required ?? base.required,
    };
}

function getActionParamOverride(
    actionName: string,
    index: number,
    typeKey?: string,
): Partial<ActionParamSchema> | undefined {
    return typeKey
        ? ACTION_PARAM_OVERRIDES_BY_TYPE[typeKey]?.[actionName]?.[index] ?? ACTION_PARAM_OVERRIDES[actionName]?.[index]
        : ACTION_PARAM_OVERRIDES[actionName]?.[index];
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
                const actionName = action.name;
                if (!actionName) return acc;
                const params = (action.params ?? []).map((param, index) => {
                    const paramType = normalizeParamType(param.type);
                    const base: ActionParamSchema = {
                        name: param.name?.trim() || `param${index + 1}`,
                        type: paramType,
                        required: true,
                        min: normalizeNumericConstraint(param.minValue, paramType),
                        max: normalizeNumericConstraint(param.maxValue, paramType),
                        enum: normalizeEnum(param.supportedValues),
                    };
                    return applyParamOverride(actionName, base, index, typeKey);
                });
                acc.push({ actionName, params });
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
        mergeParamOverride({
            name: override.name ?? `param${index + 1}`,
            type: override.type ?? (override.enum ? "string" : "number"),
            required: true,
        }, override),
    );
}

export function applyParamOverride(
    actionName: string,
    base: ActionParamSchema,
    index: number,
    typeKey?: string,
): ActionParamSchema {
    const overrides = getActionParamOverride(actionName, index, typeKey);
    return mergeParamOverride(base, overrides);
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

        const mapped: Record<string, unknown> = {};
        const values = Object.values(record);
        schema.forEach((param, index) => {
            if (Object.prototype.hasOwnProperty.call(record, param.name)) {
                mapped[param.name] = record[param.name];
            } else {
                mapped[param.name] = values[index];
            }
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
        const stringValue = typeof value === "string" ? value.trim() : null;

        if (value === "" || value === undefined || value === null || stringValue === "") {
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
            if (typeof value === "string" && value.trim() === "") {
                if (isRequired) {
                    errors.push({
                        field: param.name,
                        message: `Completa ${label.toLowerCase()}.`,
                    });
                }
                continue;
            }
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

        if (typeof value === "string") {
            if (param.maxLength && value.length > param.maxLength) {
                errors.push({
                    field: param.name,
                    message: `${label} debe tener maximo ${param.maxLength} caracteres.`,
                });
                continue;
            }
            if (param.name === "securityCode" && !/^\d{1,6}$/.test(value)) {
                errors.push({
                    field: param.name,
                    message: `El codigo de seguridad debe ser numerico.`,
                });
                continue;
            }
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
