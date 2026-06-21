import os
import random
import pickle
import numpy as np

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
except ImportError:
    # Si sklearn no está instalado durante la edición del archivo, se ignorará
    # pero el script fallará si se corre sin él.
    pass

def generar_datos_sinteticos(n_muestras=2000):
    """
    Genera un conjunto de datos sintético basado en reglas biológicas de avicultura.
    """
    np.random.seed(42)
    random.seed(42)
    
    X = []
    y = []
    
    for _ in range(n_muestras):
        # 1. Edad en días (típicamente de 1 a 45 días)
        edad = random.randint(1, 45)
        
        # 2. Temperatura promedio en las últimas 24h
        # Lo normal es de 20 a 28 grados. Simula de 15 a 40.
        temp = round(random.uniform(15, 40), 1)
        
        # 3. Desviación en el consumo de alimento en las últimas 24h
        # En porcentaje: -35% (comen muy poco) a +10% (sobreconsumo)
        feed_dev = round(random.uniform(-35, 10), 1)
        
        # 4. Bajas registradas en los últimos 3 días (0 a 120 bajas)
        bajas = random.randint(0, 120)
        
        # 5. Alerta sanitaria activa (0 = No, 1 = Sí)
        alerta = 1 if random.random() < 0.15 else 0
        
        # --- Cálculo Lógico del Riesgo para Generar Etiqueta ---
        riesgo_score = 0.05  # Base line
        
        # Estrés por temperatura
        if temp > 34:
            riesgo_score += (temp - 34) * 0.06  # Calor extremo aumenta riesgo
        elif temp < 18:
            riesgo_score += (18 - temp) * 0.03  # Frío aumenta riesgo
            
        # Desviación de alimentación
        if feed_dev < -10:
            riesgo_score += abs(feed_dev + 10) * 0.015  # Mayor caída en alimento = mayor enfermedad
            
        # Bajas previas acumuladas
        if bajas > 10:
            riesgo_score += (bajas / 120.0) * 0.40  # Historial de bajas correlaciona con epidemias
            
        # Alertas sanitarias activas
        if alerta == 1:
            riesgo_score += 0.25  # Enfermedad confirmada
            
        # Factor edad
        if edad <= 7:
            riesgo_score += 0.08  # Adaptación inicial
        elif edad > 35:
            riesgo_score += 0.05  # Aves adultas y pesadas son más frágiles al calor
            
        # Determinamos nivel de riesgo para clasificar
        # 1 = Alto Riesgo (Riesgo total calculado > 0.22)
        # 0 = Bajo/Medio Riesgo (Riesgo total calculado <= 0.22)
        target = 1 if riesgo_score > 0.22 else 0
        
        X.append([edad, temp, feed_dev, bajas, alerta])
        y.append(target)
        
    return np.array(X), np.array(y)

def entrenar_y_guardar_modelo():
    print("Generando datos sintéticos para el entrenamiento...")
    X, y = generar_datos_sinteticos()
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Entrenando modelo RandomForestClassifier...")
    model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    model.fit(X_train, y_train)
    
    train_acc = model.score(X_train, y_train)
    test_acc = model.score(X_test, y_test)
    print(f"Precisión en Entrenamiento: {train_acc*100:.2f}%")
    print(f"Precisión en Test: {test_acc*100:.2f}%")
    
    # Ruta de guardado
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(current_dir, "modelo_mortalidad.pkl")
    
    print(f"Guardando modelo en: {model_path}")
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    
    print("¡Modelo de IA entrenado y guardado con éxito!")

if __name__ == "__main__":
    entrenar_y_guardar_modelo()
