from django.db import models


class Galpon(models.Model):
	id = models.BigAutoField(primary_key=True)
	nombre = models.CharField(max_length=100, unique=True)
	capacidad = models.IntegerField()
	descripcion = models.TextField(blank=True, null=True)
	estado = models.CharField(max_length=20, default='activo')

	class Meta:
		db_table = 'galpones'

	def __str__(self):
		return self.nombre
