-- Datos semilla para la demo (contraseña de todos: "123456", ya hasheada con bcrypt)
-- Hash generado con bcryptjs (10 rounds) para el texto "123456"

INSERT INTO usuarios (nombre_completo, correo, password_hash, rol, area_apoyo) VALUES
('Ana Rojas', 'ana.tutor@usalesiana.edu.bo', '$2a$10$b.WQtZ2fJW1V2lj.vtSoh.1S1j/IG/tDFBj.VFAFGRgHplTbEQ6S2', 'tutor', 'Metodologia de Investigacion'),
('Carlos Mamani', 'carlos.tutor@usalesiana.edu.bo', '$2a$10$b.WQtZ2fJW1V2lj.vtSoh.1S1j/IG/tDFBj.VFAFGRgHplTbEQ6S2', 'tutor', 'Estadistica y SPSS'),
('Lucia Fernandez', 'lucia.estudiante@usalesiana.edu.bo', '$2a$10$b.WQtZ2fJW1V2lj.vtSoh.1S1j/IG/tDFBj.VFAFGRgHplTbEQ6S2', 'estudiante', NULL),
('Jorge Quispe', 'jorge.estudiante@usalesiana.edu.bo', '$2a$10$b.WQtZ2fJW1V2lj.vtSoh.1S1j/IG/tDFBj.VFAFGRgHplTbEQ6S2', 'estudiante', NULL),
('Marta Villarroel', 'coordinacion@usalesiana.edu.bo', '$2a$10$b.WQtZ2fJW1V2lj.vtSoh.1S1j/IG/tDFBj.VFAFGRgHplTbEQ6S2', 'coordinador', NULL);

INSERT INTO disponibilidad (tutor_id, dia_semana, hora_inicio, hora_fin) VALUES
(1, 1, '09:00', '12:00'),
(1, 3, '14:00', '17:00'),
(2, 2, '10:00', '13:00');

INSERT INTO sesiones (estudiante_id, tutor_id, fecha, hora_inicio, hora_fin, tema, estado) VALUES
(3, 1, CURRENT_DATE + 2, '09:00', '10:00', 'Marco teorico - capitulo 2', 'completada'),
(4, 2, CURRENT_DATE + 3, '10:00', '11:00', 'Analisis estadistico de datos', 'solicitada');

INSERT INTO bitacora_sesion (sesion_id, asistio, tema_avanzado, notas) VALUES
(1, TRUE, 'Marco teorico - capitulo 2', 'Se reviso estructura del capitulo, pendiente ajustar antecedentes.');

