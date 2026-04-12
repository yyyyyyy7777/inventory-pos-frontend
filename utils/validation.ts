export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

// Validation rules
export const validators = {
  required: (value: string | number, fieldName: string): ValidationError | null => {
    if (!value || (typeof value === "string" && value.trim() === "")) {
      return { field: fieldName, message: `${fieldName} is required` }
    }
    return null
  },

  minLength: (value: string, min: number, fieldName: string): ValidationError | null => {
    if (value && value.length < min) {
      return { field: fieldName, message: `${fieldName} must be at least ${min} characters` }
    }
    return null
  },

  maxLength: (value: string, max: number, fieldName: string): ValidationError | null => {
    if (value && value.length > max) {
      return { field: fieldName, message: `${fieldName} must not exceed ${max} characters` }
    }
    return null
  },

  positiveNumber: (value: string | number, fieldName: string): ValidationError | null => {
    const num = Number(value)
    if (value !== "" && (isNaN(num) || num < 0)) {
      return { field: fieldName, message: `${fieldName} must be a positive number` }
    }
    return null
  },

  nonNegativeNumber: (value: string | number, fieldName: string): ValidationError | null => {
    const num = Number(value)
    if (value !== "" && (isNaN(num) || num < 0)) {
      return { field: fieldName, message: `${fieldName} must be zero or greater` }
    }
    return null
  },

  integerNumber: (value: string | number, fieldName: string): ValidationError | null => {
    const num = Number(value)
    if (value !== "" && (isNaN(num) || !Number.isInteger(num))) {
      return { field: fieldName, message: `${fieldName} must be a whole number` }
    }
    return null
  },

  positiveInteger: (value: string | number, fieldName: string): ValidationError | null => {
    const num = Number(value)
    if (value !== "" && (isNaN(num) || !Number.isInteger(num) || num <= 0)) {
      return { field: fieldName, message: `${fieldName} must be a positive whole number` }
    }
    return null
  },

  maxNumber: (value: string | number, max: number, fieldName: string): ValidationError | null => {
    const num = Number(value)
    if (value !== "" && (isNaN(num) || num > max)) {
      return { field: fieldName, message: `${fieldName} must not exceed ${max}` }
    }
    return null
  },

  minNumber: (value: string | number, min: number, fieldName: string): ValidationError | null => {
    const num = Number(value)
    if (value !== "" && (isNaN(num) || num < min)) {
      return { field: fieldName, message: `${fieldName} must be at least ${min}` }
    }
    return null
  },

  decimalPlaces: (value: string | number, maxDecimals: number, fieldName: string): ValidationError | null => {
    const num = Number(value)
    if (value !== "" && !isNaN(num)) {
      const decimals = num.toString().split('.')[1]
      if (decimals && decimals.length > maxDecimals) {
        return { field: fieldName, message: `${fieldName} must not have more than ${maxDecimals} decimal places` }
      }
    }
    return null
  },

  alphanumeric: (value: string, fieldName: string): ValidationError | null => {
    if (value && !/^[a-zA-Z0-9\s]+$/.test(value)) {
      return { field: fieldName, message: `${fieldName} must contain only letters, numbers, and spaces` }
    }
    return null
  },

  noSpecialChars: (value: string, fieldName: string): ValidationError | null => {
    if (value && /[<>\"'&]/.test(value)) {
      return { field: fieldName, message: `${fieldName} must not contain special characters like < > \" ' &` }
    }
    return null
  },

  sku: (value: string, fieldName: string): ValidationError | null => {
    if (value && !/^[A-Z0-9\-_]+$/.test(value)) {
      return { field: fieldName, message: `${fieldName} must contain only uppercase letters, numbers, hyphens, and underscores` }
    }
    return null
  },

  email: (value: string, fieldName: string): ValidationError | null => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { field: fieldName, message: `${fieldName} must be a valid email address` }
    }
    return null
  },

  phone: (value: string, fieldName: string): ValidationError | null => {
    if (value && !/^[+]?[\d\s\-\(\)]+$/.test(value)) {
      return { field: fieldName, message: `${fieldName} must be a valid phone number` }
    }
    return null
  },

  url: (value: string, fieldName: string): ValidationError | null => {
    if (value && !/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(value)) {
      return { field: fieldName, message: `${fieldName} must be a valid URL` }
    }
    return null
  },

  date: (value: string, fieldName: string): ValidationError | null => {
    if (value && isNaN(Date.parse(value))) {
      return { field: fieldName, message: `${fieldName} must be a valid date` }
    }
    return null
  },

  futureDate: (value: string, fieldName: string): ValidationError | null => {
    if (value) {
      const date = new Date(value)
      if (isNaN(date.getTime()) || date <= new Date()) {
        return { field: fieldName, message: `${fieldName} must be a future date` }
      }
    }
    return null
  },

  pastDate: (value: string, fieldName: string): ValidationError | null => {
    if (value) {
      const date = new Date(value)
      if (isNaN(date.getTime()) || date >= new Date()) {
        return { field: fieldName, message: `${fieldName} must be a past date` }
      }
    }
    return null
  },

  inRange: (value: string | number, min: number, max: number, fieldName: string): ValidationError | null => {
    const num = Number(value)
    if (value !== "" && (isNaN(num) || num < min || num > max)) {
      return { field: fieldName, message: `${fieldName} must be between ${min} and ${max}` }
    }
    return null
  },

  oneOf: (value: string, allowedValues: string[], fieldName: string): ValidationError | null => {
    if (value && !allowedValues.includes(value)) {
      return { field: fieldName, message: `${fieldName} must be one of: ${allowedValues.join(', ')}` }
    }
    return null
  },

  regex: (value: string, pattern: RegExp, message: string, fieldName: string): ValidationError | null => {
    if (value && !pattern.test(value)) {
      return { field: fieldName, message: `${fieldName}: ${message}` }
    }
    return null
  }
}

// Validation schemas
export const validateProductForm = (data: {
  name?: string
  price?: string | number
  quantity?: string | number
  category?: string
  sku?: string
  description?: string
  costPrice?: string | number
  imageUrl?: string
}, requireQuantity: boolean = true, requirePrice: boolean = true): ValidationResult => {
  const errors: ValidationError[] = []

  // Name validation
  const nameErr = validators.required(data.name || "", "Product Name")
  if (nameErr) errors.push(nameErr)
  
  const nameMinErr = validators.minLength(data.name || "", 2, "Product Name")
  if (nameMinErr) errors.push(nameMinErr)
  
  const nameMaxErr = validators.maxLength(data.name || "", 100, "Product Name")
  if (nameMaxErr) errors.push(nameMaxErr)

  const nameSpecialErr = validators.noSpecialChars(data.name || "", "Product Name")
  if (nameSpecialErr) errors.push(nameSpecialErr)
  
  // SKU validation (optional)
  if (data.sku) {
    const skuErr = validators.sku(data.sku, "SKU")
    if (skuErr) errors.push(skuErr)
    
    const skuMaxErr = validators.maxLength(data.sku, 50, "SKU")
    if (skuMaxErr) errors.push(skuMaxErr)
  }
  
  // Price validation
  if (requirePrice) {
    const priceVal = data.price ?? ""
    const priceErr = validators.required(priceVal, "Price")
    if (priceErr) errors.push(priceErr)
    
    const priceNumErr = validators.positiveNumber(priceVal, "Price")
    if (priceNumErr) errors.push(priceNumErr)

    const priceDecimalErr = validators.decimalPlaces(priceVal, 2, "Price")
    if (priceDecimalErr) errors.push(priceDecimalErr)

    const priceMaxErr = validators.maxNumber(priceVal, 999999.99, "Price")
    if (priceMaxErr) errors.push(priceMaxErr)
  }
  
  // Quantity validation
  if (requireQuantity) {
    const qtyVal = data.quantity ?? ""
    const qtyErr = validators.required(qtyVal, "Quantity")
    if (qtyErr) errors.push(qtyErr)
    
    const qtyNumErr = validators.positiveInteger(qtyVal, "Quantity")
    if (qtyNumErr) errors.push(qtyNumErr)

    const qtyMaxErr = validators.maxNumber(qtyVal, 999999, "Quantity")
    if (qtyMaxErr) errors.push(qtyMaxErr)
  }
  
  // Category validation
  const catErr = validators.required(data.category || "", "Category")
  if (catErr) errors.push(catErr)
  
  const catMaxErr = validators.maxLength(data.category || "", 50, "Category")
  if (catMaxErr) errors.push(catMaxErr)

  if (data.description) {
    const descMaxErr = validators.maxLength(data.description, 2000, "Product details / description")
    if (descMaxErr) errors.push(descMaxErr)
  }

  if (data.costPrice !== undefined && data.costPrice !== "") {
    const cErr = validators.nonNegativeNumber(data.costPrice, "Acquired price (cost)")
    if (cErr) errors.push(cErr)
    const cDec = validators.decimalPlaces(data.costPrice, 2, "Acquired price (cost)")
    if (cDec) errors.push(cDec)
    const cMax = validators.maxNumber(data.costPrice, 999999.99, "Acquired price (cost)")
    if (cMax) errors.push(cMax)
  }

  if (data.imageUrl && data.imageUrl.length > 450000) {
    errors.push({ field: "imageUrl", message: "Image is too large after compression; try a smaller photo" })
  }

  return { isValid: errors.length === 0, errors }
}

export const validateStockBatch = (data: {
  productId?: string | number
  quantity?: string | number
  costPerUnit?: string | number
  cabinet?: string
}): ValidationResult => {
  const errors: ValidationError[] = []

  // Product ID validation
  const idVal = data.productId ?? ""
  const idErr = validators.required(idVal, "Product ID")
  if (idErr) errors.push(idErr)
  
  const idNumErr = validators.positiveInteger(idVal, "Product ID")
  if (idNumErr) errors.push(idNumErr)

  // Quantity validation
  const qtyVal = data.quantity ?? ""
  const qtyErr = validators.required(qtyVal, "Quantity")
  if (qtyErr) errors.push(qtyErr)
  
  const qtyNumErr = validators.positiveInteger(qtyVal, "Quantity")
  if (qtyNumErr) errors.push(qtyNumErr)

  const qtyMaxErr = validators.maxNumber(qtyVal, 999999, "Quantity")
  if (qtyMaxErr) errors.push(qtyMaxErr)

  // Cost per unit validation (optional)
  if (data.costPerUnit !== undefined && data.costPerUnit !== "") {
    const costNumErr = validators.nonNegativeNumber(data.costPerUnit || "", "Cost per Unit")
    if (costNumErr) errors.push(costNumErr)

    const costDecimalErr = validators.decimalPlaces(data.costPerUnit || "", 2, "Cost per Unit")
    if (costDecimalErr) errors.push(costDecimalErr)

    const costMaxErr = validators.maxNumber(data.costPerUnit || "", 999999.99, "Cost per Unit")
    if (costMaxErr) errors.push(costMaxErr)
  }

  // Cabinet validation
  const cabinetErr = validators.required(data.cabinet || "", "Cabinet")
  if (cabinetErr) errors.push(cabinetErr)
  
  const cabinetMaxErr = validators.maxLength(data.cabinet || "", 50, "Cabinet")
  if (cabinetMaxErr) errors.push(cabinetMaxErr)

  const cabinetSpecialErr = validators.noSpecialChars(data.cabinet || "", "Cabinet")
  if (cabinetSpecialErr) errors.push(cabinetSpecialErr)

  return { isValid: errors.length === 0, errors }
}

export const validateStockDeduction = (data: {
  productId?: string | number
  quantity?: string | number
  cabinet?: string
  notes?: string
}): ValidationResult => {
  const errors: ValidationError[] = []

  // Product ID validation
  const idVal = data.productId ?? ""
  const idErr = validators.required(idVal, "Product ID")
  if (idErr) errors.push(idErr)
  
  const idNumErr = validators.positiveInteger(idVal, "Product ID")
  if (idNumErr) errors.push(idNumErr)

  // Quantity validation
  const qtyVal = data.quantity ?? ""
  const qtyErr = validators.required(qtyVal, "Quantity")
  if (qtyErr) errors.push(qtyErr)
  
  const qtyNumErr = validators.positiveInteger(qtyVal, "Quantity")
  if (qtyNumErr) errors.push(qtyNumErr)

  const qtyMaxErr = validators.maxNumber(qtyVal, 999999, "Quantity")
  if (qtyMaxErr) errors.push(qtyMaxErr)

  // Cabinet validation
  const cabinetErr = validators.required(data.cabinet || "", "Cabinet")
  if (cabinetErr) errors.push(cabinetErr)
  
  const cabinetMaxErr = validators.maxLength(data.cabinet || "", 50, "Cabinet")
  if (cabinetMaxErr) errors.push(cabinetMaxErr)

  // Notes validation (optional)
  if (data.notes) {
    const notesMaxErr = validators.maxLength(data.notes, 200, "Notes")
    if (notesMaxErr) errors.push(notesMaxErr)

    const notesSpecialErr = validators.noSpecialChars(data.notes, "Notes")
    if (notesSpecialErr) errors.push(notesSpecialErr)
  }

  return { isValid: errors.length === 0, errors }
}
