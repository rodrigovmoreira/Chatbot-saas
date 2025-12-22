const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const authenticateToken = require('../middleware/auth');

// ROTA: GET /api/appointments (Listar)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = { userId: req.user.userId };

    // Filtro por data (usado pelo calendário)
    if (start && end) {
      query.start = { $gte: new Date(start), $lte: new Date(end) };
    }

    const appointments = await Appointment.find(query).sort({ start: 1 });
    res.json(appointments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao buscar agenda' });
  }
});

// ROTA: POST /api/appointments (Criar com validação)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { clientName, clientPhone, title, start, end, type } = req.body;

    // Validação de Conflito de Horário
    const conflito = await Appointment.findOne({
      userId: req.user.userId,
      status: 'agendado',
      $or: [
        { start: { $lt: new Date(end), $gte: new Date(start) } },
        { end: { $gt: new Date(start), $lte: new Date(end) } }
      ]
    });

    if (conflito) {
      return res.status(409).json({ message: 'Já existe um agendamento neste horário!' });
    }

    const newAppointment = await Appointment.create({
      userId: req.user.userId,
      clientName,
      clientPhone,
      title,
      start,
      end,
      type
    });

    res.status(201).json(newAppointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar agendamento' });
  }
});

// ROTA: DELETE /api/appointments/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await Appointment.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Agendamento removido' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar' });
  }
});

module.exports = router;