/**
 * product-extractor.js - Módulo para extraer productos individuales de tickets
 */

const ProductExtractor = {
    /**
     * Extrae productos individuales del texto de un ticket
     * @param {Object} receipt - Datos del ticket escaneado
     * @returns {Array} - Lista de productos extraídos
     */
    async extractFromReceipt(receipt) {
        try {
            // Extraer texto del ticket
            const receiptText = receipt.rawText;
            
            // Extraer productos del texto
            const products = await this.extractProductsFromText(receiptText);
            
            // Enriquecer con metadatos del ticket
            return products.map(product => ({
                ...product,
                store: receipt.merchant,
                receiptDate: receipt.date,
                receiptId: receipt.id || this.generateUUID()
            }));
        } catch (error) {
            console.error('Error al extraer productos del ticket:', error);
            return [];
        }
    },
    
    /**
     * Extrae productos individuales del texto de un ticket
     * @param {string} text - Texto del ticket
     * @returns {Array} - Lista de productos extraídos
     */
    async extractProductsFromText(text) {
        const products = [];
        const lines = text.split('\n');
        
        // Patrones para detectar líneas de productos
        const productLineRegex = /(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR)?$/i;
        const quantityRegex = /(\d+)\s*[xX]\s*(.+)/;
        
        for (const line of lines) {
            // Ignorar líneas muy cortas o que contengan palabras clave no deseadas
            if (line.length < 5 || /total|subtotal|iva|factura|ticket|fecha|hora/i.test(line)) {
                continue;
            }
            
            // Intentar extraer producto y precio
            const match = line.match(productLineRegex);
            if (match) {
                let productName = match[1].trim();
                const price = parseFloat(match[2].replace(',', '.'));
                
                // Comprobar si hay cantidad
                let quantity = 1;
                const quantityMatch = productName.match(quantityRegex);
                if (quantityMatch) {
                    quantity = parseInt(quantityMatch[1]);
                    productName = quantityMatch[2].trim();
                }
                
                // Normalizar nombre del producto
                const normalizedName = this.normalizeProductName(productName);
                
                products.push({
                    id: this.generateUUID(),
                    name: productName,
                    normalizedName,
                    price,
                    quantity,
                    totalPrice: price * quantity,
                    category: this.guessProductCategory(normalizedName)
                });
            }
        }
        
        return products;
    },
    
    /**
     * Normaliza el nombre de un producto para facilitar comparaciones
     * @param {string} name - Nombre del producto
     * @returns {string} - Nombre normalizado
     */
    normalizeProductName(name) {
        return name
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]/g, '')
            .trim();
    },
    
    /**
     * Intenta adivinar la categoría de un producto basándose en su nombre
     * @param {string} productName - Nombre del producto
     * @returns {string} - Categoría sugerida
     */
    guessProductCategory(productName) {
        const name = productName.toLowerCase();
        
        // Mapeo de palabras clave a categorías
        const categoryKeywords = {
            'frutas y verduras': ['manzana', 'plátano', 'naranja', 'tomate', 'lechuga', 'cebolla', 'patata', 'zanahoria', 'fruta', 'verdura'],
            'lácteos': ['leche', 'yogur', 'queso', 'mantequilla', 'nata', 'yoghourt'],
            'carnes': ['pollo', 'ternera', 'cerdo', 'jamón', 'salchicha', 'carne', 'filete', 'lomo'],
            'pescados': ['pescado', 'merluza', 'atún', 'salmón', 'bacalao', 'dorada', 'lubina', 'marisco'],
            'panadería': ['pan', 'barra', 'bollo', 'croissant', 'galleta', 'bizcocho'],
            'bebidas': ['agua', 'refresco', 'zumo', 'cerveza', 'vino', 'leche', 'café', 'té'],
            'congelados': ['congelado', 'helado', 'pizza'],
            'limpieza': ['detergente', 'jabón', 'lejía', 'suavizante', 'papel', 'servilleta'],
            'higiene': ['champú', 'gel', 'desodorante', 'pasta', 'cepillo', 'papel higiénico']
        };
        
        // Buscar coincidencias
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            for (const keyword of keywords) {
                if (name.includes(keyword)) {
                    return category;
                }
            }
        }
        
        return 'otros'; // Categoría por defecto
    },
    
    /**
     * Genera un UUID v4
     * @returns {string} - UUID generado
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};

// Exportar el módulo
window.ProductExtractor = ProductExtractor;