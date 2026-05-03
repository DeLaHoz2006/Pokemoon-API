// Tomamos del HTML el boton que abre el menu de filtros.
const openMenu = document.getElementById("openMenu");
// Tomamos el boton que cierra el menu de filtros.
const closeMenu = document.getElementById("closeMenu");
// Este es el contenedor oscuro / popup del menu.
const menuEmergent = document.getElementById("menuEmergent");
// Input donde el usuario escribe el nombre del Pokemon.
const input = document.getElementById("search");
// Lista donde se muestran las sugerencias debajo del input.
const suggestions = document.getElementById("suggestions");
// Contenedor donde pintamos las tarjetas de resultados.
const result = document.getElementById("pokemonResult");
// Formulario general del buscador.
const searchForm = document.querySelector(".navi-form");
// Caja que contiene input + sugerencias. Sirve para detectar clicks afuera.
const searchShell = document.querySelector(".search-shell");
// Select del filtro por tipo.
const filterType = document.getElementById("filterType");
// Select del filtro por habitat.
const filterHabitat = document.getElementById("filterHabit");
// Checkbox para mostrar solo legendarios.
const filterLegendary = document.getElementById("filterLegendary");

// Aqui guardaremos la lista base de Pokemon que trae la API.
let pokemonList = [];
// Cambio: cache simple para no volver a pedir el mismo Pokemon en cada filtro.
const pokemonCache = new Map();
// Cambio: limite de resultados automaticos en pantalla.
const MAX_RESULTS = 6;
// Cantidad maxima de candidatos antes de filtrar por detalles.
const MAX_CANDIDATES = 12;
// Guardamos el id del timeout para el debounce.
let searchTimeoutId;
// Guardamos la promesa de carga inicial para esperar la lista si hace falta.
let pokemonListReady;

// Esta funcion carga la lista general de Pokemon una sola vez.
async function loadPokemonList() {
    try {
        // Pedimos la lista completa de nombres.
        const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1302");
        // Convertimos la respuesta a JSON.
        const data = await response.json();

        // Guardamos solo el array de resultados dentro de pokemonList.
        pokemonList = data.results;
    } catch (error) {
        // Si algo sale mal, lo mandamos a consola para depurar.
        console.error("Error cargando lista:", error);
    }
}

// Este evento corre cada vez que escribes algo en el input.
input.addEventListener("input", function () {
    // Tomamos el texto, lo pasamos a minusculas y quitamos espacios sobrantes.
    const text = input.value.toLowerCase().trim();

    // Si el usuario borra todo el texto...
    if (!text) {
        // ...ocultamos sugerencias...
        suggestions.innerHTML = "";
        // Cambio: si limpian el input, tambien limpio los resultados.
        // ...y tambien limpiamos las tarjetas.
        result.innerHTML = "";
        return;
    }

    // Filtramos la lista base para quedarnos solo con nombres que empiecen igual.
    const matches = pokemonList
        .filter(pokemon => pokemon.name.startsWith(text))
        // Mostramos maximo 6 sugerencias para no llenar demasiado la pantalla.
        .slice(0, 6);

    // Convertimos las coincidencias en <li> y las metemos dentro del <ul>.
    suggestions.innerHTML = matches
        .map(pokemon => `<li class="suggestion-item">${pokemon.name}</li>`)
        .join("");

    // Cambio: busqueda automatica con un pequeno debounce.
    // Esto espera un poquito antes de consultar resultados, para no disparar todo por cada tecla.
    scheduleResultsUpdate();
});

// Si existe el formulario, escuchamos cuando el usuario presiona Enter.
if (searchForm) {
    searchForm.addEventListener("submit", async function (e) {
        // Evita que el formulario recargue la pagina.
        e.preventDefault();

        // Leemos el nombre actual escrito en el input.
        const pokemonName = input.value.toLowerCase().trim();

        // Si no hay nombre, no hacemos nada.
        if (!pokemonName) {
            return;
        }

        // Al confirmar la busqueda, limpiamos la lista de sugerencias.
        suggestions.innerHTML = "";
        // Cambio: Enter ahora fuerza la actualizacion automatica de cards.
        // Y actualizamos las tarjetas en pantalla.
        await updateResults();
    });
}

// Este evento escucha clicks sobre la lista de sugerencias.
suggestions.addEventListener("click", async function (e) {
    // Nos aseguramos de que el click haya sido sobre un <li>.
    if (e.target.tagName === "LI") {
        // Tomamos el nombre del Pokemon clickeado.
        const pokemonName = e.target.textContent;
        // Lo colocamos dentro del input.
        input.value = pokemonName;
        // Cerramos la lista de sugerencias.
        suggestions.innerHTML = "";

        // Cambio: click en sugerencia actualiza resultados automaticamente.
        // Y actualizamos las tarjetas con ese nombre.
        await updateResults();
    }
});

// Cambio: si haces click fuera del buscador, cierro solo la lista de sugerencias.
document.addEventListener("click", function (e) {
    // Si por alguna razon no existe el contenedor del buscador, salimos.
    if (!searchShell) {
        return;
    }

    // Si el click fue fuera del input / sugerencias...
    if (!searchShell.contains(e.target)) {
        // ...limpiamos solo la lista, pero no tocamos las tarjetas.
        suggestions.innerHTML = "";
    }
});

// Reemplaza guiones por espacios para que la info se vea mas bonita.
function formatLabel(text) {
    return text.replace(/-/g, " ");
}

// Busca una descripcion del Pokemon, primero en espanol y si no hay, en ingles.
function getFlavorText(entries) {
    // Buscamos una entrada cuyo idioma sea espanol.
    const spanishEntry = entries.find(entry => entry.language.name === "es");
    // Si no encontramos espanol, buscamos ingles.
    const englishEntry = entries.find(entry => entry.language.name === "en");
    // Nos quedamos con la primera disponible.
    const entry = spanishEntry || englishEntry;

    // Si no existe ninguna descripcion, devolvemos un texto por defecto.
    if (!entry) {
        return "Sin descripcion disponible.";
    }

    // Limpiamos saltos raros que devuelve la API.
    return entry.flavor_text.replace(/\f|\n|\r/g, " ");
}

// Esta funcion hace debounce: espera un poco antes de disparar updateResults().
function scheduleResultsUpdate() {
    // Si habia un timeout anterior, lo cancelamos.
    clearTimeout(searchTimeoutId);
    // Creamos uno nuevo de 250 ms.
    searchTimeoutId = setTimeout(function () {
        // Cuando se cumple el tiempo, actualizamos los resultados.
        updateResults();
    }, 250);
}

// Trae los detalles de un Pokemon especifico y los guarda en cache.
async function fetchPokemonDetails(name) {
    // Normalizamos el nombre a minusculas.
    const normalizedName = name.toLowerCase();

    // Si ya lo habiamos pedido antes, devolvemos la version cacheada.
    if (pokemonCache.has(normalizedName)) {
        return pokemonCache.get(normalizedName);
    }

    try {
        // URL de datos principales: tipos, stats, imagen, etc.
        const pokemonUrl = `https://pokeapi.co/api/v2/pokemon/${normalizedName}`;
        // URL de datos de especie: habitat, descripcion, legendario, etc.
        const speciesUrl = `https://pokeapi.co/api/v2/pokemon-species/${normalizedName}`;

        // Hacemos ambas peticiones al mismo tiempo para ahorrar espera.
        const [response, speciesResponse] = await Promise.all([
            fetch(pokemonUrl),
            fetch(speciesUrl)
        ]);

        // Si la respuesta principal falla, lanzamos error.
        if (!response.ok) {
            throw new Error("Pokemon no encontrado");
        }

        // Convertimos la respuesta principal a JSON.
        const data = await response.json();
        // Si species responde bien, la convertimos; si no, dejamos null.
        const speciesData = speciesResponse.ok ? await speciesResponse.json() : null;
        // Juntamos ambos objetos en uno solo.
        const pokemonDetails = { data, speciesData };

        // Guardamos el resultado en cache para reutilizarlo.
        pokemonCache.set(normalizedName, pokemonDetails);
        // Devolvemos el objeto final.
        return pokemonDetails;
    } catch (error) {
        // Relanzamos el error para manejarlo mas arriba.
        throw error;
    }
}

// Esta funcion construye el HTML de una tarjeta de Pokemon.
function renderPokemonCard(data, speciesData) {
    // Usamos la ilustracion oficial si existe; si no, la imagen frontal.
    const officialArtwork = data.sprites.other["official-artwork"].front_default || data.sprites.front_default;
    // Unimos las habilidades en un texto separado por comas.
    const abilities = data.abilities.map(ability => formatLabel(ability.ability.name)).join(", ");
    // Convertimos cada stat en un <li>.
    const stats = data.stats
        .map(stat => `<li><span>${formatLabel(stat.stat.name)}</span><strong>${stat.base_stat}</strong></li>`)
        .join("");
    // Leemos el habitat o mostramos "desconocido".
    const habitat = speciesData?.habitat ? formatLabel(speciesData.habitat.name) : "desconocido";
    // Sacamos la descripcion limpia.
    const description = speciesData ? getFlavorText(speciesData.flavor_text_entries) : "Sin descripcion disponible.";
    // Definimos la etiqueta superior: Mitico, Legendario o Comun.
    const specialTag = speciesData?.is_mythical
        ? "Mitico"
        : speciesData?.is_legendary
            ? "Legendario"
            : "Comun";

    // Devolvemos un template string con el HTML completo de la card.
    return `
        <article class="pokemon-card">
            <div class="pokemon-header">
                <div class="pokemon-topline">
                    <p class="pokemon-tag">${specialTag}</p>
                    <p class="pokemon-id">#${data.id}</p>
                </div>
                <h2 class="pokemon-name">${data.name}</h2>
            </div>
            <div class="pokemon-figure">
                <img class="pokemon-image" src="${officialArtwork}" alt="${data.name}">
            </div>
            <p class="pokemon-description">${description}</p>
            <div class="pokemon-stats-block">
                <p class="pokemon-section-title">Base Stats</p>
                <ul class="pokemon-stats">
                    ${stats}
                </ul>
            </div>
            <div class="pokemon-meta">
                <p><strong>Tipo:</strong> ${data.types.map(type => formatLabel(type.type.name)).join(", ")}</p>
                <p><strong>Altura:</strong> ${data.height / 10} m</p>
                <p><strong>Peso:</strong> ${data.weight / 10} kg</p>
                <p><strong>Habitat:</strong> ${habitat}</p>
                <p><strong>Habilidades:</strong> ${abilities}</p>
                <p><strong>Experiencia base:</strong> ${data.base_experience}</p>
            </div>
        </article>
    `;
}

// Cambio: funcion central que actualiza automaticamente los resultados en pantalla.
async function updateResults() {
    // Cambio: espero a que la lista base este lista antes de filtrar.
    // Si la lista aun se esta cargando, esperamos a que termine.
    if (pokemonListReady) {
        await pokemonListReady;
    }

    // Leemos el texto actual del buscador.
    const text = input.value.toLowerCase().trim();

    // Si el input esta vacio, limpiamos resultados.
    if (!text) {
        result.innerHTML = "";
        return;
    }

    // Buscamos candidatos por nombre a partir de la lista base.
    const candidates = pokemonList
        .filter(pokemon => pokemon.name.startsWith(text))
        // Limitamos candidatos para no hacer demasiadas consultas.
        .slice(0, MAX_CANDIDATES);

    // Si no hay coincidencias por nombre, mostramos mensaje.
    if (candidates.length === 0) {
        result.innerHTML = `<p class="result-message">No se encontraron Pokemon con ese nombre.</p>`;
        return;
    }

    try {
        // Para cada candidato, traemos sus datos completos.
        const detailedCandidates = await Promise.all(
            candidates.map(async function (pokemon) {
                const details = await fetchPokemonDetails(pokemon.name);
                return {
                    name: pokemon.name,
                    ...details
                };
            })
        );

        // Aplicamos filtros y luego limitamos las cards finales.
        const filteredPokemon = detailedCandidates
            .filter(function (pokemon) {
                return applyFilters(pokemon.data, pokemon.speciesData);
            })
            .slice(0, MAX_RESULTS);

        // Si despues de aplicar filtros no queda ninguno, mostramos mensaje.
        if (filteredPokemon.length === 0) {
            result.innerHTML = `<p class="result-message">No hay Pokemon que coincidan con los filtros activos.</p>`;
            return;
        }

        // Construimos el HTML de todas las tarjetas y lo pintamos.
        result.innerHTML = filteredPokemon
            .map(function (pokemon) {
                return renderPokemonCard(pokemon.data, pokemon.speciesData);
            })
            .join("");
    } catch (error) {
        // Si algo falla, mostramos el error en pantalla.
        result.innerHTML = `<p class="result-message">${error.message}</p>`;
    }
}

// Cambio: guardo la promesa para reutilizarla cuando se actualicen resultados.
// Cargamos la lista base al iniciar la pagina.
pokemonListReady = loadPokemonList();




if (openMenu && closeMenu && menuEmergent) {
    openMenu.addEventListener("click", function () {
        // Al abrir, agregamos la clase que muestra el overlay.
        menuEmergent.classList.add("mostrar");
    });

    closeMenu.addEventListener("click", function () {
        // Al cerrar, quitamos esa clase.
        menuEmergent.classList.remove("mostrar");
    });

    menuEmergent.addEventListener("click", function (e) {
        // Si el click fue sobre el fondo oscuro y no sobre el popup, cerramos.
        if (e.target === menuEmergent) {
            menuEmergent.classList.remove("mostrar");
        }
    });
}

// Estado actual de los filtros.
const filters = {
    type: "all",
    habitat: "all",
    legendary: false
};

filterType.addEventListener("change", function () {
    // Guardamos el tipo que el usuario selecciono.
    filters.type = filterType.value;
    // Cambio: los filtros ahora actualizan resultados automaticamente.
    updateResults();
});

filterHabitat.addEventListener("change", function () {
    // Guardamos el habitat elegido.
    filters.habitat = filterHabitat.value;
    // Cambio: los filtros ahora actualizan resultados automaticamente.
    updateResults();
});

filterLegendary.addEventListener("change", function () {
    // Guardamos si el checkbox esta marcado o no.
    filters.legendary = filterLegendary.checked;
    // Cambio: los filtros ahora actualizan resultados automaticamente.
    updateResults();
});

// Esta funcion decide si un Pokemon pasa o no los filtros activos.
function applyFilters(data, speciesData) {
    // Cambio: el filtro de tipo compara con filters.type, no con habitat.
    // Si type es "all", cualquier tipo sirve. Si no, debe coincidir alguno.
    const matchesType =
        filters.type === "all" ||
        data.types.some(t => t.type.name === filters.type);

    // Si habitat es "all", cualquiera sirve. Si no, debe coincidir.
    const matchesHabits =
        filters.habitat === "all" ||
        speciesData?.habitat?.name === filters.habitat;

    // Si el checkbox no esta marcado, cualquier Pokemon sirve.
    // Si esta marcado, solo pasan los legendarios.
    const matchesLengendary =
        !filters.legendary ||
        speciesData?.is_legendary;

    // Solo devuelve true si se cumplen las 3 condiciones.
    return matchesType && matchesHabits && matchesLengendary;
}
