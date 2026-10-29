import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Briefcase,
  ChevronLeft,
  Home,
  Landmark,
  Mail,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  ShieldOff,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput";
import { ZipCodeCityInput } from "@/components/ZipCodeCityInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterKpiCard } from "@/components/FilterKpiCard";
import { NodoQuotaSummary } from "@/components/nodo/NodoQuotaSummary";
import { NodoMailFilterSection } from "@/components/NodoMailFilterSection";
import { InAppRepliesSection } from "@/components/InAppRepliesSection";
import { DeleteAgencySection } from "@/components/DeleteAgencySection";
import { LicencesCard } from "@/components/LicencesCard";
import { AccountControl } from "@/components/agency/AccountControl";
import {
  FIELD_CLASS,
  IconInput,
  serviceIcons,
} from "@/components/agency/agencyUi";
import { OwnAgencyPage } from "@/components/agency/OwnAgencyPage";
import { useGeranceBilling } from "@/hooks/useGeranceBilling";
import {
  DEFAULT_AGENT_PRICE_CENTS,
  formatCents,
  isBillingActive,
  isLegacyBilling,
  licenceUsage,
} from "@/lib/licences";
import { Switch } from "@/components/ui/switch";
import {
  cn,
  ICON_TILE_CLASS,
  ICON_TILE_OFF_CLASS,
  ICON_TILE_ON_CLASS,
  PANEL_CARD_CLASS,
  PRIMARY_CTA_CLASS,
} from "@/lib/utils";
import {
  createGerance,
  inviteAgencyAccount,
  revokeAgencyAccount,
  revokeSuccessMessage,
  REVOKE_CONFIRM_MESSAGE,
  setDeptAccountUid,
  subscribeToGerance,
  subscribeToGerances,
  updateGerance,
  type GeranceInput,
} from "@/lib/gerances";
import { resolveUsersByUids } from "@/lib/users";
import { subscribeToResidencesForGerance } from "@/lib/residences";
import { searchCompanies, type CompanySearchResult } from "@/lib/companySearch";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useAccountRole } from "@/hooks/useAccountRole";
import { useAuth } from "@/lib/auth-context";
import { emptyAddress } from "@/types/residence";
import { billingStatusLabels } from "@/types/billing";
import {
  AGENT_UID_FIELD,
  emptyAgencyDept,
  serviceTypeLabels,
  type AgencyDept,
  type Gerance,
  type ServiceType,
} from "@/types/gerance";
import type { KonodalUser } from "@/types/user";

const serviceTypes: ServiceType[] = ["serviceSyndic", "geranceLocative"];

// Phrase de chaque service (fiche agence du superAdmin).
const serviceDescriptions: Record<ServiceType, string> = {
  serviceSyndic: "L'agence gère des copropriétés sur Konodal.",
  geranceLocative: "L'agence gère aussi des biens en location.",
};

// siret/responsableLegal compris : sans eux, enregistrer la fiche effaçait
// ces deux champs (updateGerance les réécrit vides).
function geranceToInput(gerance: Gerance): GeranceInput {
  return {
    name: gerance.name,
    address: gerance.address,
    services: gerance.services,
    siret: gerance.siret,
    responsableLegal: gerance.responsableLegal,
  };
}

function matchesSearch(gerance: Gerance, search: string): boolean {
  const haystack = [
    gerance.name,
    gerance.address.street,
    gerance.address.zipCode,
    gerance.address.city,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export default function AgencesPage() {
  const [allGerances, setAllGerances] = useState<Gerance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceType | null>(null);
  const {
    isSuperAdmin,
    isAgence,
    isAgent,
    geranceId: ownGeranceId,
  } = useAccountRole();

  useEffect(() => {
    setLoading(true);
    return subscribeToGerances(
      (data) => {
        setAllGerances(data);
        setLoading(false);
      },
      (error) => {
        toast.error("Impossible de charger les agences : " + error.message);
        setLoading(false);
      },
    );
  }, []);

  // Une agence/agent ne doit voir/gérer que SA PROPRE fiche, jamais
  // l'annuaire complet (coordonnées et agents des autres agences, y compris
  // potentiellement concurrentes) - contrairement à firestore.rules qui
  // laisse la lecture ouverte à tout signed-in (annuaire non scopé
  // résidence par conception, cf. recherche par email côté app), c'est ici
  // une restriction volontaire côté BO.
  const gerances = useMemo(() => {
    if (isSuperAdmin) return allGerances;
    if (isAgence || isAgent)
      return allGerances.filter((g) => g.id === ownGeranceId);
    return [];
  }, [allGerances, isSuperAdmin, isAgence, isAgent, ownGeranceId]);

  const filteredGerances = useMemo(
    () =>
      gerances.filter((gerance) => {
        if (serviceFilter && !gerance.services[serviceFilter]) return false;
        return matchesSearch(gerance, search);
      }),
    [gerances, search, serviceFilter],
  );

  const totalSyndics = gerances.filter(
    (gerance) => gerance.services.serviceSyndic,
  ).length;
  const totalAgencies = gerances.filter(
    (gerance) => gerance.services.geranceLocative,
  ).length;

  // Une Agence/un Agent n'a ni vue agrégée (KPI sur TOUTES les agences n'a
  // pas de sens pour un compte scopé à la sienne) ni répertoire à parcourir
  // (une seule fiche possible) : page dédiée, détaillée, sur le modèle des
  // pages détail du BO (ResidenceDetailPage, SinistreDetailPage...) plutôt
  // que la liste/table pensée pour Superadmin. Agence peut la modifier
  // (matrice de droits BO), Agent est en lecture seule.
  const isOwnAgencyView = isAgence || isAgent;
  const ownGerance = isOwnAgencyView ? (gerances[0] ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      {isOwnAgencyView ? (
        <OwnAgencyPage
          gerance={ownGerance}
          loading={loading}
          canEdit={isAgence}
        />
      ) : (
        <>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
            Agences
          </h1>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FilterKpiCard
              label="Total des professionnels de l'immo"
              value={gerances.length}
              icon={Briefcase}
              colorClass="bg-slate-100 text-slate-600"
              active={serviceFilter === null}
              onClick={() => setServiceFilter(null)}
            />
            <FilterKpiCard
              label="Total des syndics"
              value={totalSyndics}
              icon={Landmark}
              colorClass="bg-sky-100 text-sky-600"
              active={serviceFilter === "serviceSyndic"}
              onClick={() =>
                setServiceFilter((prev) =>
                  prev === "serviceSyndic" ? null : "serviceSyndic",
                )
              }
            />
            <FilterKpiCard
              label="Total des agences"
              value={totalAgencies}
              icon={Home}
              colorClass="bg-emerald-100 text-emerald-600"
              active={serviceFilter === "geranceLocative"}
              onClick={() =>
                setServiceFilter((prev) =>
                  prev === "geranceLocative" ? null : "geranceLocative",
                )
              }
            />
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="text-lg">Répertoire des agences</h2>
            <p className="text-sm text-muted-foreground">
              Rechercher, filtrer et gérer toutes les agences.
            </p>
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-center gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une agence…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              {isSuperAdmin && (
                <Button
                  className={`ml-auto ${PRIMARY_CTA_CLASS}`}
                  onClick={() => setCreating(true)}
                >
                  <Plus />
                  Ajouter une agence
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col">
            <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Agence</TableHead>
                    <TableHead>Adresse</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {filteredGerances.map((gerance) => {
                    const activeServices = serviceTypes.filter(
                      (type) => gerance.services[type],
                    );
                    const primaryContact = activeServices
                      .map((type) => gerance.services[type]?.mail)
                      .find((mail) => mail);
                    return (
                      <TableRow key={gerance.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                              <Briefcase className="size-4" />
                            </div>
                            {gerance.name}
                          </div>
                        </TableCell>
                        <TableCell>{gerance.address.street}</TableCell>
                        <TableCell>{gerance.address.city}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {activeServices.length === 0 && (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {activeServices.map((type) => (
                              <Badge key={type} variant="secondary">
                                {serviceTypeLabels[type]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{primaryContact || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            render={<Link to={`/agences/${gerance.id}`} />}
                          >
                            <Pencil />
                            Modifier
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && filteredGerances.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {gerances.length === 0
                          ? "Aucune agence pour l'instant."
                          : "Aucun résultat pour cette recherche."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <GeranceFormDialog
            open={creating}
            onOpenChange={setCreating}
            title="Ajouter une agence"
            onSubmit={async (input) => {
              await createGerance(input);
              toast.success("Agence créée");
              setCreating(false);
            }}
          />
        </>
      )}
    </div>
  );
}

// Fiche d'une agence pour le superAdmin (/agences/:id), sur le modèle des
// fiches résidence et utilisateur : « Modifier » du répertoire y mène, plus
// de modale. Même formulaire que la création (GeranceForm), avec à côté les
// licences, la consommation de Nodo et l'option « Nodo répond aux
// copropriétaires ». Le compte agence garde sa propre page (OwnAgencyPage).
export function AgenceDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [gerance, setGerance] = useState<Gerance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    return subscribeToGerance(
      id,
      (data) => {
        setGerance(data);
        setLoading(false);
      },
      (error) => {
        toast.error("Impossible de charger l'agence : " + error.message);
        setLoading(false);
      },
    );
  }, [id]);

  // Copie de travail figée au chargement de CETTE agence : les instantanés
  // suivants (compte invité, agent ajouté) mettent à jour les statuts mais
  // n'écrasent pas une saisie en cours.
  const [initial, setInitial] = useState<GeranceInput | undefined>();
  useEffect(() => {
    setInitial(undefined);
  }, [id]);
  useEffect(() => {
    if (gerance && gerance.id === id && !initial)
      setInitial(geranceToInput(gerance));
  }, [gerance, id, initial]);

  const activeServices = gerance
    ? serviceTypes.filter((type) => gerance.services[type])
    : [];

  const billing = useGeranceBilling(id);

  const [residenceCount, setResidenceCount] = useState<number | null>(null);
  useEffect(() => {
    setResidenceCount(null);
    return subscribeToResidencesForGerance(
      id,
      (residences) => setResidenceCount(residences.length),
      () => setResidenceCount(null),
    );
  }, [id]);

  // Agents nommés : comptes des tableaux d'agents hors compte générique de
  // chaque service (même filtre que NamedAgentsManager).
  const agentCount = useMemo(() => {
    if (!gerance) return 0;
    const serviceUids = new Set(
      serviceTypes.map((type) => gerance.services[type]?.uid).filter(Boolean),
    );
    return new Set(
      serviceTypes
        .flatMap((type) => gerance[AGENT_UID_FIELD[type]] ?? [])
        .filter((uid) => !serviceUids.has(uid)),
    ).size;
  }, [gerance]);

  return (
    <div className="-mt-[20px] flex flex-col gap-5">
      <Link
        to="/agences"
        className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-[oklch(42%_0.08_155)] hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        Agences
      </Link>

      {!gerance && (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
            {loading ? "…" : "Agence introuvable"}
          </h1>
          {!loading && (
            <p className="text-muted-foreground">
              Cette agence n'existe pas ou a été supprimée.
            </p>
          )}
        </div>
      )}

      {gerance && (
        <>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white p-[22px_28px] shadow-[0_14px_34px_-24px_oklch(20%_0_0/0.14)]">
            <div className="flex min-w-[240px] flex-1 items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-[oklch(93%_0.05_150)]">
                <Briefcase className="size-6 text-[oklch(32%_0.09_155)]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-[24px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
                    {gerance.name || "Agence"}
                  </h1>
                  {activeServices.map((type) => (
                    <span
                      key={type}
                      className="rounded-full bg-[oklch(93%_0.05_150)] px-2.5 py-0.5 text-[12px] font-bold text-[oklch(32%_0.09_155)]"
                    >
                      {serviceTypeLabels[type]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <dl className="m-0 flex gap-8">
              <HeaderStat label="Résidences" value={residenceCount ?? "…"} />
              <HeaderStat label="Agents" value={agentCount} />
              <HeaderStat
                label="Abonnement"
                value={
                  billing.status === "none"
                    ? "Aucun"
                    : billingStatusLabels[billing.status]
                }
                tone={
                  billing.status === "active"
                    ? "positive"
                    : billing.status === "none"
                      ? "muted"
                      : "default"
                }
              />
            </dl>
          </div>

          {initial && (
            <GeranceForm
              key={gerance.id}
              variant="page"
              initial={initial}
              gerance={gerance}
              onSubmit={async (input) => {
                await updateGerance(gerance.id, input);
                setInitial(input);
                toast.success("Agence mise à jour");
              }}
              aside={
                <>
                  <LicencesCard gerance={gerance} billing={billing} />
                  <NodoQuotaSummary geranceId={gerance.id} />
                  <NodoMailFilterSection geranceId={gerance.id} />
                  <InAppRepliesSection gerance={gerance} />
                  <DeleteAgencySection gerance={gerance} />
                </>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

// Chiffre de l'en-tête de la fiche agence (Résidences, Agents, Abonnement).
function HeaderStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "positive" | "muted";
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-bold tracking-wide text-[oklch(48%_0.01_150)] uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 text-[20px] leading-none font-extrabold",
          tone === "positive"
            ? "text-[oklch(42%_0.09_155)]"
            : tone === "muted"
              ? "text-[oklch(55%_0.01_150)]"
              : "text-[oklch(22%_0.01_150)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// Création d'une agence (répertoire Superadmin) : seul usage restant de la
// modale, la modification se fait sur la fiche /agences/:id.
function GeranceFormDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: (input: GeranceInput) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <GeranceForm
          resetKey={open}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4"
          bodyClassName="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]"
          header={
            <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
              <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">
                Agence
              </span>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
          }
          renderFooter={(buttons) => <DialogFooter>{buttons}</DialogFooter>}
        />
      </DialogContent>
    </Dialog>
  );
}

// Formulaire complet d'une agence (identité, services, comptes, agents) :
// dans la modale de création, et sur la fiche /agences/:id (variant "page" :
// cartes, colonne de droite `aside` hors du <form>, Annuler/Enregistrer dans
// la carte Identité).
function GeranceForm({
  initial,
  gerance,
  onSubmit,
  onCancel,
  resetKey,
  header,
  className,
  bodyClassName = "flex flex-col gap-4",
  renderFooter = (buttons) => (
    <div className="flex justify-end gap-2 border-t pt-4">{buttons}</div>
  ),
  variant = "dialog",
  aside,
}: {
  initial?: GeranceInput;
  // Objet Gerance PERSISTÉ (distinct de `initial`, la copie de travail
  // éditable) - fourni uniquement en édition, jamais en création (une
  // agence pas encore enregistrée n'a pas d'id à invitier dessus). Passé
  // jusqu'à ServiceSection pour le statut "compte actif" par agent.
  gerance?: Gerance | null;
  onSubmit: (input: GeranceInput) => Promise<void>;
  onCancel?: () => void;
  // Les champs repartent de `initial` quand cette valeur change (ouverture
  // de la modale) ; sur la fiche, le formulaire est remonté par sa clé.
  resetKey?: unknown;
  header?: ReactNode;
  className?: string;
  bodyClassName?: string;
  renderFooter?: (buttons: ReactNode) => ReactNode;
  variant?: "dialog" | "page";
  // Colonne de droite (variant "page") : hors du <form>, ses champs (plafond
  // Nodo...) et ses fenêtres ne soumettent jamais la fiche.
  aside?: ReactNode;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [street, setStreet] = useState(
    initial?.address.street ?? emptyAddress.street,
  );
  const [zipCode, setZipCode] = useState(
    initial?.address.zipCode ?? emptyAddress.zipCode,
  );
  const [city, setCity] = useState(initial?.address.city ?? emptyAddress.city);
  const [siret, setSiret] = useState(initial?.siret ?? "");
  const [responsableLegal, setResponsableLegal] = useState(
    initial?.responsableLegal ?? "",
  );
  const [services, setServices] = useState<
    Partial<Record<ServiceType, AgencyDept>>
  >(initial?.services ?? {});
  const [submitting, setSubmitting] = useState(false);

  // Recherche recherche-entreprises.api.gouv.fr (cf. companySearch.ts) - même
  // usage que ProfilePage (agence éditant sa propre fiche), mais ici pas de
  // gerance.id à l'écriture directe : une agence pas encore créée n'a pas de
  // document Firestore à mettre à jour, donc un résultat choisi ne fait que
  // préremplir les champs ci-dessous, revus/corrigibles avant "Enregistrer".
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<CompanySearchResult[]>(
    [],
  );
  const [searching, setSearching] = useState(false);

  function resetFields() {
    setName(initial?.name ?? "");
    setStreet(initial?.address.street ?? emptyAddress.street);
    setZipCode(initial?.address.zipCode ?? emptyAddress.zipCode);
    setCity(initial?.address.city ?? emptyAddress.city);
    setSiret(initial?.siret ?? "");
    setResponsableLegal(initial?.responsableLegal ?? "");
    setServices(initial?.services ?? {});
    setCompanyQuery("");
    setCompanyResults([]);
  }

  useEffect(() => {
    resetFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remise à zéro à l'ouverture seulement
  }, [resetKey]);

  async function handleSearchCompany() {
    if (!companyQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchCompanies(companyQuery);
      setCompanyResults(results);
      if (results.length === 0)
        toast.error("Aucun résultat pour cette recherche");
    } catch (err) {
      toast.error("Recherche impossible : " + (err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  function handleApplyCompanyResult(result: CompanySearchResult) {
    setName(result.name);
    setStreet(result.address.street);
    setZipCode(result.address.zipCode);
    setCity(result.address.city);
    setResponsableLegal(result.responsableLegal);
    setSiret(result.siret);
    setCompanyResults([]);
    setCompanyQuery("");
    toast.success(
      "Informations reprises depuis la recherche - vérifiez avant d'enregistrer",
    );
  }

  function toggleService(type: ServiceType, enabled: boolean) {
    setServices((prev) => {
      const next = { ...prev };
      if (enabled) {
        next[type] = next[type] ?? { ...emptyAgencyDept };
      } else {
        delete next[type];
      }
      return next;
    });
  }

  function updateDept(type: ServiceType, dept: AgencyDept) {
    setServices((prev) => ({ ...prev, [type]: dept }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        address: { ...emptyAddress, street, zipCode, city },
        services,
        siret,
        responsableLegal,
      });
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Recherche d'entreprise : à la création seulement (modale) - la fiche
  // d'une agence existante n'en a plus besoin (maquette).
  const identityFields = (
    <>
      {variant === "dialog" && (
        <div className="flex flex-col gap-2.5 rounded-[16px] border-[1.5px] border-dashed border-[oklch(80%_0.06_155)] bg-[oklch(97.5%_0.012_155)] p-3">
          <div className="flex gap-2.5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ger-company-search"
                aria-label="Rechercher l'entreprise (SIREN, SIRET ou nom)"
                placeholder="Préremplir depuis SIREN, SIRET ou nom d'entreprise…"
                className="h-10 rounded-[10px] bg-white pl-9"
                value={companyQuery}
                onChange={(e) => setCompanyQuery(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (e.preventDefault(), handleSearchCompany())
                }
              />
            </div>
            <Button
              type="button"
              onClick={handleSearchCompany}
              disabled={searching}
              className="h-10 rounded-[10px] border-0 bg-[oklch(30%_0.06_155)] px-4 font-bold text-white hover:bg-[oklch(35%_0.07_155)]"
            >
              Rechercher
            </Button>
          </div>
          {companyResults.length > 0 && (
            <div className="flex flex-col gap-2">
              {companyResults.map((result) => (
                <div
                  key={result.siret || result.siren}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-white p-2.5 text-sm"
                >
                  <div>
                    <span className="font-medium">{result.name}</span>
                    <span className="text-muted-foreground">
                      {" — "}
                      {[
                        result.address.street,
                        [result.address.zipCode, result.address.city].join(" "),
                      ]
                        .filter(Boolean)
                        .join(" — ") || "—"}
                      {result.responsableLegal
                        ? ` · ${result.responsableLegal}`
                        : ""}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleApplyCompanyResult(result)}
                  >
                    Utiliser ces informations
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ger-name">Nom de l'agence</Label>
          <Input
            id="ger-name"
            required
            className={FIELD_CLASS}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ger-responsable">Responsable légal</Label>
          <Input
            id="ger-responsable"
            className={FIELD_CLASS}
            value={responsableLegal}
            onChange={(e) => setResponsableLegal(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ger-street">Adresse</Label>
        <AddressAutocompleteInput
          id="ger-street"
          required
          className={FIELD_CLASS}
          value={street}
          onChange={setStreet}
          onSelect={(a) => {
            setStreet(a.street);
            setZipCode(a.zipCode);
            setCity(a.city);
          }}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ger-zip">Code postal</Label>
          <ZipCodeCityInput
            id="ger-zip"
            required
            className={FIELD_CLASS}
            value={zipCode}
            onChange={setZipCode}
            onCityResolved={setCity}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ger-city">Ville</Label>
          <Input
            id="ger-city"
            required
            className={FIELD_CLASS}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ger-siret">SIRET / SIREN</Label>
        <Input
          id="ger-siret"
          placeholder="123 456 789 00012"
          className={FIELD_CLASS}
          value={siret}
          onChange={(e) => setSiret(e.target.value)}
        />
      </div>
    </>
  );

  const serviceSections = serviceTypes.map((type) => (
    <ServiceSection
      key={type}
      type={type}
      dept={services[type]}
      gerance={gerance}
      onToggle={(enabled) => toggleService(type, enabled)}
      onChange={(dept) => updateDept(type, dept)}
    />
  ));

  if (variant === "page") {
    return (
      <>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-5">
            <section className={cn(PANEL_CARD_CLASS, "flex flex-col gap-4")}>
              <h2 className="p-0 font-sans text-[15px] font-bold text-[oklch(22%_0.01_150)]">
                Identité de l'agence
              </h2>
              {identityFields}
              {/* Pas de bandeau collant (demande de l'utilisateur) : boutons
                    dans la carte Identité, ils enregistrent toute la fiche. */}
              <div className="flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-[12px] bg-white px-4 font-semibold"
                  onClick={resetFields}
                  disabled={submitting}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    PRIMARY_CTA_CLASS,
                    "h-10 rounded-[12px] px-5 font-bold",
                  )}
                >
                  <Save />
                  Enregistrer
                </Button>
              </div>
            </section>
            {serviceSections}
          </form>
          <aside className="flex flex-col gap-4">{aside}</aside>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {header}

      <div className={bodyClassName}>
        {identityFields}
        <div className="flex flex-col gap-3">{serviceSections}</div>
      </div>

      {renderFooter(
        <>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className={PRIMARY_CTA_CLASS}
          >
            <Save />
            Enregistrer
          </Button>
        </>,
      )}
    </form>
  );
}

function ServiceSection({
  type,
  dept,
  gerance,
  onToggle,
  onChange,
}: {
  type: ServiceType;
  dept?: AgencyDept;
  gerance?: Gerance | null;
  onToggle: (enabled: boolean) => void;
  onChange: (dept: AgencyDept) => void;
}) {
  const enabled = dept !== undefined;

  // Désactiver tout un service alors qu'il reste des comptes actifs dessus
  // (compte générique ou agents nommés, tous deux dans ce même tableau
  // désormais) le couperait sans passer par revoke_agency_account -
  // il faut d'abord tous les révoquer.
  const uidField = AGENT_UID_FIELD[type];
  const deptHasActiveAccount = (gerance?.[uidField]?.length ?? 0) > 0;
  // Adresse verrouillée uniquement tant qu'un compte ACTIF y est rattaché
  // (identifiant de la licence). Compte révoqué ou jamais invité : elle peut
  // être remplacée (ex. compte de test -> vraie adresse de l'agence).
  const persistedDept = gerance?.services[type];
  const mailLocked =
    !!persistedDept?.mail &&
    !!persistedDept.uid &&
    !!gerance?.[uidField]?.includes(persistedDept.uid);

  const ServiceIcon = serviceIcons[type];
  const titleId = `${type}-service-title`;
  // Licence service souscrite : la retirer d'abord (carte Abonnement), sinon
  // le service disparaîtrait de la fiche en restant facturé.
  const billing = useGeranceBilling(gerance?.id);
  const subscribed = billing.serviceLicences.includes(type);
  const switchLocked = enabled && (deptHasActiveAccount || subscribed);

  return (
    <div className={cn(PANEL_CARD_CLASS, "flex flex-col gap-4")}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            ICON_TILE_CLASS,
            enabled ? ICON_TILE_ON_CLASS : ICON_TILE_OFF_CLASS,
          )}
        >
          <ServiceIcon />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            id={titleId}
            className="text-[15px] font-bold text-[oklch(22%_0.01_150)]"
          >
            {serviceTypeLabels[type]}
          </span>
          <span className="text-[12.5px] text-muted-foreground">
            {serviceDescriptions[type]}
          </span>
        </div>
        <span
          title={
            enabled && deptHasActiveAccount
              ? "Révoquez l'accès de tous les comptes de ce service avant de le désactiver"
              : enabled && subscribed
                ? "Retirez d'abord la licence service de ce service (carte Abonnement)"
                : undefined
          }
        >
          <Switch
            aria-labelledby={titleId}
            checked={enabled}
            disabled={switchLocked}
            onCheckedChange={onToggle}
          />
        </span>
      </div>

      {dept && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${type}-mail`}>Email du service</Label>
              <IconInput
                icon={Mail}
                id={`${type}-mail`}
                type="email"
                value={dept.mail}
                disabled={mailLocked}
                title={
                  mailLocked
                    ? "Rattaché à un compte actif : révoquer l'accès pour changer d'adresse"
                    : undefined
                }
                // Nouvelle adresse = plus le même compte : l'uid de l'ancien
                // (révoqué) est détaché, sanitizeServices ne le réécrit pas à
                // l'enregistrement - "Inviter" s'affiche alors pour la
                // nouvelle adresse. Revenir à l'adresse enregistrée restaure
                // son uid.
                onChange={(e) => {
                  const mail = e.target.value;
                  const { uid: _uid, ...rest } = dept;
                  onChange(
                    mail === persistedDept?.mail && persistedDept?.uid
                      ? { ...rest, mail, uid: persistedDept.uid }
                      : { ...rest, mail },
                  );
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${type}-phone`}>Téléphone</Label>
              <IconInput
                icon={Phone}
                id={`${type}-phone`}
                value={dept.phone}
                onChange={(e) => onChange({ ...dept, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Cas "adresse globale par service" (pas d'agent nommé) : le
              compte se rattache directement à cette adresse générique,
              même mécanique que pour un agent précis ci-dessous. */}
          {gerance &&
            dept.mail &&
            gerance.services[type]?.mail === dept.mail && (
              <AccountControl
                gerance={gerance}
                serviceType={type}
                mail={dept.mail}
                role="agence"
                persistedUid={gerance.services[type]?.uid}
                onLinkUid={(uid) => setDeptAccountUid(gerance, type, uid)}
              />
            )}

          {gerance ? (
            <div className="border-t border-[oklch(94%_0.004_100)] pt-4">
              <NamedAgentsManager gerance={gerance} type={type} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Enregistrez d'abord l'agence pour pouvoir inviter des agents.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Liste des agents nommés d'un service - un agent n'existe QUE via
// serviceSyndicAgentUids/geranceLocativeAgentUids (compte déjà invité),
// résolu en fiche complète via resolveUsersByUids. Partagé entre
// ServiceSection (dialog Superadmin) et AgencyServiceCard (fiche Agence) :
// même mécanique, seul le contexte d'appel diffère. Éditable par
// superAdmin/agence, en lecture seule pour agent (même garde que
// AccountControl).
function NamedAgentsManager({
  gerance,
  type,
}: {
  gerance: Gerance;
  type: ServiceType;
}) {
  const { isSuperAdmin } = useIsSuperAdmin();
  const { isAgence } = useAccountRole();
  const { user } = useAuth();
  const canEdit = isSuperAdmin || isAgence;

  const deptUid = gerance.services[type]?.uid;
  const agentUids = useMemo(
    () =>
      (gerance[AGENT_UID_FIELD[type]] ?? []).filter((uid) => uid !== deptUid),
    [gerance, type, deptUid],
  );
  const [profiles, setProfiles] = useState<KonodalUser[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [newAgentEmail, setNewAgentEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const billing = useGeranceBilling(gerance.id);
  const usage = licenceUsage(gerance, billing);
  // Même règle que invite_agency_account : abonnement en cours et service
  // souscrit, sinon l'invitation d'un agent est refusée.
  const inviteBlocker = !isBillingActive(billing)
    ? "L'agence n'a pas d'abonnement actif : invitez d'abord le compte du service."
    : isLegacyBilling(billing)
      ? "Abonnement de l'ancienne formule : migration des licences requise."
      : !usage.subscribed.includes(type)
        ? `Le service ${serviceTypeLabels[type]} n'est pas souscrit : ajoutez d'abord sa licence service (carte Abonnement).`
        : null;

  useEffect(() => {
    if (agentUids.length === 0) {
      setProfiles([]);
      return;
    }
    let cancelled = false;
    setLoadingProfiles(true);
    resolveUsersByUids(agentUids)
      .then((users) => {
        if (!cancelled) setProfiles(users);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfiles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentUids]);

  async function handleInvite() {
    const email = newAgentEmail.trim();
    if (!email) return;
    setInviting(true);
    try {
      const result = await inviteAgencyAccount(
        gerance.id,
        type,
        email,
        "agent",
      );
      setNewAgentEmail("");
      setConfirmOpen(false);
      toast.success(
        result.pending
          ? `Email envoyé à ${email} — l'accès sera activé après paiement des licences`
          : result.licenceAdded === "agent"
            ? `Invitation envoyée à ${email} — licence agent ajoutée`
            : `Invitation envoyée à ${email}`,
      );
    } catch (err) {
      toast.error("Échec de l'invitation : " + (err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  // Agents comptés comme sièges mais sans fiche utilisateur (compte supprimé
  // hors révocation : console Firebase, script...) : invisibles sinon, donc
  // impossibles à révoquer alors qu'ils restent facturés.
  const orphanUids = useMemo(
    () =>
      loadingProfiles
        ? []
        : agentUids.filter((uid) => !profiles.some((p) => p.uid === uid)),
    [agentUids, profiles, loadingProfiles],
  );

  async function handleRevoke(uid: string) {
    if (!confirm(REVOKE_CONFIRM_MESSAGE)) return;
    try {
      toast.success(
        revokeSuccessMessage(await revokeAgencyAccount(gerance.id, type, uid)),
      );
    } catch (err) {
      toast.error("Échec de la révocation : " + (err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-bold text-[oklch(22%_0.01_150)]">
          Agents
        </span>
        <span className="rounded-full bg-[oklch(95%_0.004_100)] px-2 py-px text-[11.5px] font-bold text-muted-foreground">
          {agentUids.length}
        </span>
      </div>
      {loadingProfiles ? (
        <p className="m-0 rounded-[12px] border border-dashed border-[oklch(90%_0.005_100)] bg-[oklch(97%_0.004_100)] p-3 text-[12.5px] text-muted-foreground">
          Chargement…
        </p>
      ) : profiles.length === 0 && orphanUids.length === 0 ? (
        <p className="m-0 flex items-center gap-2.5 rounded-[12px] border border-dashed border-[oklch(90%_0.005_100)] bg-[oklch(97%_0.004_100)] p-3 text-[12.5px] text-muted-foreground">
          <Users className="size-4 shrink-0" />
          {canEdit
            ? "Aucun agent pour ce service. Invitez le premier ci-dessous."
            : "Aucun agent pour ce service."}
        </p>
      ) : (
        <>
          {orphanUids.map((uid) => (
            <div
              key={uid}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 p-2.5"
            >
              <div className="text-sm">
                <span className="font-medium">Compte supprimé</span>
                <span className="text-muted-foreground">{` — siège toujours facturé (${uid.slice(0, 8)}…)`}</span>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevoke(uid)}
                >
                  <ShieldOff />
                  Révoquer l'accès
                </Button>
              )}
            </div>
          ))}
          {profiles.map((profile) => {
            const isSelf = profile.uid === user?.uid;
            return (
              <div
                key={profile.uid}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 p-2.5"
              >
                <div className="text-sm">
                  <span className="font-medium">
                    {`${profile.name} ${profile.surname}`.trim() ||
                      profile.email}
                  </span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {[profile.email, profile.phone]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </div>
                {canEdit &&
                  (isSelf ? (
                    <span className="text-xs text-muted-foreground">
                      C'est votre compte
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(profile.uid)}
                    >
                      <ShieldOff />
                      Révoquer l'accès
                    </Button>
                  ))}
              </div>
            );
          })}
        </>
      )}
      {canEdit && inviteBlocker && (
        <p className="m-0 text-[12.5px] text-muted-foreground">
          {inviteBlocker}
        </p>
      )}
      {canEdit && !inviteBlocker && (
        <div className="flex gap-2.5">
          <IconInput
            icon={Mail}
            className="flex-1"
            aria-label="Email de l'agent à inviter"
            placeholder="Email de l'agent à inviter"
            type="email"
            value={newAgentEmail}
            onChange={(e) => setNewAgentEmail(e.target.value)}
            // Entrée : même confirmation que le bouton, jamais la
            // soumission de la fiche agence qui l'entoure.
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (newAgentEmail.trim() && !inviting) setConfirmOpen(true);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-[10px] px-3.5 text-[13px] font-bold"
            onClick={() => setConfirmOpen(true)}
            disabled={inviting || !newAgentEmail.trim()}
          >
            <Plus />
            Inviter
          </Button>
        </div>
      )}

      {/* Un nouvel agent (uid pas déjà compté sur l'autre service de cette
          gérance) ajoute immédiatement un siège facturé - prévenir avant
          l'action plutôt qu'après, cf. demande explicite. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer l'invitation</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {usage.agents.available > 0 ? (
              <>
                <strong>{newAgentEmail.trim()}</strong> utilisera 1 des{" "}
                {usage.agents.available} licence
                {usage.agents.available > 1 ? "s" : ""} agent disponible
                {usage.agents.available > 1 ? "s" : ""} : rien de plus à payer.
              </>
            ) : (
              <>
                Plus aucune licence agent disponible : inviter{" "}
                <strong>{newAgentEmail.trim()}</strong> en ajoute une,{" "}
                <strong>
                  {formatCents(DEFAULT_AGENT_PRICE_CENTS)} HT/mois
                </strong>
                {billing.status === "trialing"
                  ? ", gratuite jusqu'à la fin de l'essai."
                  : ", au prorata dès maintenant."}
              </>
            )}
          </DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={inviting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleInvite}
              disabled={inviting}
              className={PRIMARY_CTA_CLASS}
            >
              <Mail />
              Confirmer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
