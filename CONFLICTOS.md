# Cómo resolver conflictos de `js/mesas.js` en GitHub

Cuando GitHub marca conflictos en la PR (por ejemplo en `js/mesas.js`), sigue estos pasos para resolverlos de forma segura:

1. **Actualizar la rama local**
   - Asegúrate de tener la rama base (normalmente `main`) actualizada: 
     ```bash
     git fetch origin
     git checkout main
     git pull
     ```
   - Vuelve a tu rama de trabajo:
     ```bash
     git checkout work
     ```

2. **Traer los últimos cambios de la base**
   - Haz un rebase o merge con la base para traer las últimas modificaciones:
     ```bash
     git merge main
     # o
     git rebase main
     ```
   - Si aparece el conflicto en `js/mesas.js`, Git insertará marcadores `<<<<<<<`, `=======`, `>>>>>>>` dentro del archivo.

3. **Resolver el conflicto en el archivo**
   - Abre `js/mesas.js` y busca las secciones con marcadores.
   - Conserva las partes correctas de cada lado (HEAD y la rama remota) y elimina los marcadores.
   - Asegúrate de que la edición en línea de la descripción siga ocultando el punto de estado y la flecha cuando se edita.

4. **Probar y validar**
   - Guarda el archivo y verifica que no queden marcadores:
     ```bash
     rg "<<<<<<<|=======|>>>>>>>" js/mesas.js
     ```
   - Opcionalmente abre la UI para confirmar que el lápiz de edición sigue funcionando sin mostrar el punto ni la flecha.

5. **Marcar el conflicto como resuelto y subir cambios**
   ```bash
   git add js/mesas.js
   git commit -m "Resolver conflicto en js/mesas.js"
   git push
   ```

6. **Actualizar la PR en GitHub**
   - Vuelve a GitHub; el aviso de conflicto desaparecerá cuando la rama incluya tu commit de resolución.

> Tip: Si prefieres la interfaz web, haz clic en “Resolve conflicts”, edita la sección de `js/mesas.js` eliminando los marcadores y conservando el código esperado, luego guarda, marca como resuelto y realiza el commit directamente en la UI.
