export default function Policies() {
  return (
    <div className="page">
      <h1>Políticas del demo</h1>
      <p>Versión demo-v1 · datos y dinero ficticios.</p>
      <h2>Reserva y retiro</h2>
      <p>
        Se simula la reserva al pedir y el cobro al recoger en la barra
        informada. No se solicita tarjeta ni se cobra dinero real. Sin
        aceptación en 2 minutos, se anula la reserva. El cliente puede cancelar
        en cola; una vez preparando, debe solicitar ayuda. Un pedido listo sin
        retirar se cierra a los 20 minutos sin penalidad si no tiene una captura
        o retiro en curso.
      </p>
      <h2>Mayoría de edad</h2>
      <p>
        El checkbox no sustituye la verificación presencial. La demo no autoriza
        venta ni consumo real de alcohol.
      </p>
      <h2>Privacidad</h2>
      <p>
        Supabase conserva una sesión invitada, pedidos, aceptación de políticas
        y eventos operativos. Personal autorizado del local ve sus pedidos. El
        QR habilita el retiro y no debe compartirse. Al borrar la sesión o
        cambiar de dispositivo no se recuperan pedidos con el código.
      </p>
      <h2>Ayuda y datos</h2>
      <p>
        Consultá el contacto del local en el pedido. Los administradores del
        proyecto demo pueden eliminar los datos al reiniciar el entorno local.
        No ingresés datos sensibles. Antes de un piloto deben aprobarse
        políticas, soporte y retención definitivos.
      </p>
    </div>
  );
}
