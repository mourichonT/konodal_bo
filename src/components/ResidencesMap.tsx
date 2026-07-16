import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection, Point } from "geojson"
import type { Residence } from "@/types/residence"

const SOURCE_ID = "residences"

// Fond de carte OpenStreetMap en tuiles raster : gratuit, sans clé API,
// contrairement à Mapbox/Google Maps. Le clustering (GeoJSON source
// `cluster: true`) est géré nativement par MapLibre (supercluster en
// interne), rendu en WebGL - ça encaisse des dizaines de milliers de points
// sans ralentir, contrairement à un marqueur DOM par résidence.
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
}

function toGeoJson(residences: Residence[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: residences
      .filter((r): r is Residence & { lat: number; lng: number } => r.lat != null && r.lng != null)
      .map((r) => ({
        type: "Feature",
        properties: { id: r.id, name: r.name },
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      })),
  }
}

// Centre la vue sur le plus gros cluster visible (celui qui regroupe le
// plus de résidences), une seule fois au premier chargement - un ajustement
// utile par défaut plutôt que la vue France entière, sans re-recentrer à
// chaque mise à jour des données (nouvelles résidences géocodées en tâche
// de fond) qui perturberait la navigation en cours de l'utilisateur.
function focusOnBiggestCluster(map: maplibregl.Map): boolean {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  if (!source) return false

  const clusterFeatures = map.queryRenderedFeatures({ layers: ["clusters"] })
  if (clusterFeatures.length === 0) return false

  const biggest = clusterFeatures.reduce((max, feature) =>
    (feature.properties?.point_count ?? 0) > (max.properties?.point_count ?? 0) ? feature : max
  )
  const clusterId = biggest.properties?.cluster_id
  if (clusterId === undefined) return false

  source.getClusterExpansionZoom(clusterId).then((zoom) => {
    const geometry = biggest.geometry as Point
    map.flyTo({ center: geometry.coordinates as [number, number], zoom })
  })
  return true
}

export function ResidencesMap({ residences }: { residences: Residence[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const hasFocusedRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [2.2137, 46.2276], // centre de la France
      zoom: 4.5,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    map.addControl(new maplibregl.AttributionControl({ compact: true }))

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: toGeoJson(residences),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      })

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#5a8f6f",
          "circle-radius": ["step", ["get", "point_count"], 16, 25, 20, 100, 26],
          "circle-opacity": 0.85,
        },
      })

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
          "text-font": ["Noto Sans Regular"],
        },
        paint: { "text-color": "#ffffff" },
      })

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#5a8f6f",
          "circle-radius": 6,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      })

      map.on("click", "clusters", (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0]
        const clusterId = feature?.properties?.cluster_id
        const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource
        if (clusterId === undefined) return
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          const geometry = feature.geometry as Point
          map.easeTo({ center: geometry.coordinates as [number, number], zoom })
        })
      })

      map.on("click", "unclustered-point", (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const geometry = feature.geometry as Point
        new maplibregl.Popup()
          .setLngLat(geometry.coordinates as [number, number])
          .setText(String(feature.properties?.name ?? ""))
          .addTo(map)
      })

      map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"))
      map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""))
      map.on("mouseenter", "unclustered-point", () => (map.getCanvas().style.cursor = "pointer"))
      map.on("mouseleave", "unclustered-point", () => (map.getCanvas().style.cursor = ""))
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la carte ne doit s'initialiser qu'une fois ; les données sont mises à jour via l'effet ci-dessous.
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const applyData = () => {
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
      source?.setData(toGeoJson(residences))
      if (!hasFocusedRef.current) {
        map.once("idle", () => {
          hasFocusedRef.current = focusOnBiggestCluster(map)
        })
      }
    }
    if (map.isStyleLoaded()) applyData()
    else map.once("load", applyData)
  }, [residences])

  return <div ref={containerRef} className="h-full w-full" />
}
