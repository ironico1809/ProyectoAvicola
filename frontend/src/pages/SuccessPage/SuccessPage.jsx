import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Mail, ArrowRight } from 'lucide-react';
import './SuccessPage.css';

function SuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Opcional: Se puede guardar un log o limpiar intentos previos
  }, [sessionId]);

  return (
    <div className="sp-page">
      <div className="sp-card">
        <div className="sp-icon-wrapper">
          <Check size={44} color="#ffffff" strokeWidth={3} />
        </div>

        <h1 className="sp-title">¡Suscripción Confirmada!</h1>
        <p className="sp-subtitle">
          Tu pago ha sido procesado con éxito y tu entorno de granja avícola ha sido aprovisionado de forma segura en la nube.
        </p>

        <div className="sp-info-box">
          <div className="sp-info-title">
            <Mail size={18} /> Revisa tu Bandeja de Correo
          </div>
          <p className="sp-info-text">
            Te hemos enviado un correo con tus credenciales de administrador y una contraseña temporal segura. Por políticas de seguridad SaaS, deberás cambiarla en tu primer ingreso.
          </p>
        </div>

        <button
          onClick={() => navigate('/login')}
          className="sp-btn"
          type="button"
        >
          Ir al Inicio de Sesión <ArrowRight size={18} />
        </button>

        <p className="sp-footer-text">
          AviGranja Pro · Sistema de Gestión Multi-Tenant
        </p>
      </div>
    </div>
  );
}

export default SuccessPage;
