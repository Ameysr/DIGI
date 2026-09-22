import { HeartHandshake, ImageUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/stat'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { describeDbError } from '@/lib/errors'
import {
  useAllCharitiesForAdmin,
  useCreateCharity,
  useDeleteCharity,
  useUpdateCharityRecord,
  useUploadCharityImage,
  type CharityFormValues,
} from '@/lib/hooks/useCharities'
import type { Charity } from '@/lib/types'

const EMPTY_FORM: CharityFormValues = {
  name: '',
  slug: '',
  short_blurb: '',
  description: '',
  website_url: null,
  image_url: null,
  is_featured: false,
  is_active: true,
}

/** URL-safe slug, so admins do not have to invent one by hand. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function AdminCharities() {
  const { data: charities, isLoading, isError, error } = useAllCharitiesForAdmin()
  const create = useCreateCharity()
  const update = useUpdateCharityRecord()
  const remove = useDeleteCharity()
  const uploadImage = useUploadCharityImage()
  const imageInput = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState<Charity | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Charity | null>(null)
  const [form, setForm] = useState<CharityFormValues>(EMPTY_FORM)

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setCreating(true)
  }

  const openEdit = (charity: Charity) => {
    setForm({
      name: charity.name,
      slug: charity.slug,
      short_blurb: charity.short_blurb,
      description: charity.description,
      website_url: charity.website_url,
      image_url: charity.image_url,
      is_featured: charity.is_featured,
      is_active: charity.is_active,
    })
    setEditing(charity)
  }

  const closeForm = () => {
    setCreating(false)
    setEditing(null)
    create.reset()
    update.reset()
  }

  async function handleSave() {
    const payload: CharityFormValues = {
      ...form,
      slug: form.slug || slugify(form.name),
    }

    try {
      if (editing) await update.mutateAsync({ id: editing.id, values: payload })
      else await create.mutateAsync(payload)
      closeForm()
    } catch {
      // Rendered from the mutation error inside the dialog.
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      setDeleting(null)
    } catch {
      // Rendered below.
    }
  }

  /**
   * Uploads immediately rather than holding the file until save: the bucket
   * returns a public URL, and storing that on the row is simpler than managing a
   * pending upload alongside an unsaved form.
   */
  async function handleImage(file: File | undefined) {
    if (!file) return
    try {
      const url = await uploadImage.mutateAsync(file)
      setForm((current) => ({ ...current, image_url: url }))
    } catch {
      // Rendered from uploadImage.error.
    } finally {
      if (imageInput.current) imageInput.current.value = ''
    }
  }

  const formError = create.error ?? update.error
  const isSaving = create.isPending || update.isPending
  const formOpen = creating || Boolean(editing)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-display text-3xl text-ink">Charities</h1>
          <p className="text-sm text-muted">
            These listings appear in the public directory. Spotlighted charities are featured on the
            homepage.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Add charity
        </Button>
      </header>

      {remove.isError ? (
        <Alert tone="danger" title="Could not delete that charity">
          {describeDbError(remove.error)}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{charities?.length ?? 0} charities</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-danger">
              {error instanceof Error ? error.message : 'Could not load charities.'}
            </p>
          ) : (charities ?? []).length === 0 ? (
            <EmptyState
              icon={HeartHandshake}
              title="No charities yet"
              description="Add the first listing to populate the public directory."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus />
                  Add charity
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(charities ?? []).map((charity) => (
                  <TableRow key={charity.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-ink">{charity.name}</span>
                        <span className="line-clamp-1 text-xs text-muted">
                          {charity.short_blurb}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted">{charity.slug}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {charity.is_active ? (
                          <Badge tone="accent">Active</Badge>
                        ) : (
                          <Badge tone="muted">Hidden</Badge>
                        )}
                        {charity.is_featured ? <Badge tone="gold">Spotlight</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${charity.name}`}
                          onClick={() => openEdit(charity)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${charity.name}`}
                          onClick={() => setDeleting(charity)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* -------------------------------------------------------- Create/edit */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent
          title={editing ? 'Edit charity' : 'Add charity'}
          description="Name and blurb are shown in the public directory."
        >
          <div className="flex flex-col gap-4">
            {formError ? (
              <Alert tone="danger" title="Could not save">
                {describeDbError(formError)}
              </Alert>
            ) : null}

            <Field label="Name" htmlFor="charity-name">
              <Input
                id="charity-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    // Only auto-fill the slug while creating, so editing a name
                    // never silently changes an existing public URL.
                    slug: editing ? current.slug : slugify(event.target.value),
                  }))
                }
              />
            </Field>

            <Field label="Slug" htmlFor="charity-slug" hint="Used in the public web address.">
              <Input
                id="charity-slug"
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slug: slugify(event.target.value) }))
                }
              />
            </Field>

            <Field label="Short blurb" htmlFor="charity-blurb" hint="One line, shown on cards.">
              <Input
                id="charity-blurb"
                value={form.short_blurb}
                onChange={(event) =>
                  setForm((current) => ({ ...current, short_blurb: event.target.value }))
                }
              />
            </Field>

            <Field label="Description" htmlFor="charity-description">
              <Textarea
                id="charity-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>

            <Field label="Website" htmlFor="charity-website">
              <Input
                id="charity-website"
                type="url"
                placeholder="https://"
                value={form.website_url ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    website_url: event.target.value || null,
                  }))
                }
              />
            </Field>

            {/* PRD §08.2 asks charity profiles to carry images, so artwork is
                uploaded rather than pasted as a URL. */}
            <div className="flex flex-col gap-2">
              <Label>Artwork</Label>

              {form.image_url ? (
                <img
                  src={form.image_url}
                  alt=""
                  className="h-32 w-full rounded-lg border border-line object-cover"
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
                  No image yet
                </div>
              )}

              <input
                ref={imageInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => handleImage(event.target.files?.[0])}
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadImage.isPending}
                  onClick={() => imageInput.current?.click()}
                >
                  {uploadImage.isPending ? <Spinner /> : <ImageUp />}
                  {form.image_url ? 'Replace image' : 'Upload image'}
                </Button>

                {form.image_url ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((current) => ({ ...current, image_url: null }))}
                  >
                    Remove
                  </Button>
                ) : null}

                <span className="text-xs text-muted">PNG, JPEG or WebP, up to 5 MB.</span>
              </div>

              {uploadImage.isError ? (
                <p className="text-xs text-danger">{describeDbError(uploadImage.error)}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-4">
              <div className="flex flex-col">
                <Label htmlFor="charity-active">Visible in the directory</Label>
                <span className="text-xs text-muted">Hidden charities are not publicly listed.</span>
              </div>
              <Switch
                id="charity-active"
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, is_active: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-4">
              <div className="flex flex-col">
                <Label htmlFor="charity-featured">Homepage spotlight</Label>
                <span className="text-xs text-muted">
                  Featuring a charity supersedes any other spotlight.
                </span>
              </div>
              <Switch
                id="charity-featured"
                checked={form.is_featured}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, is_featured: checked }))
                }
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!form.name.trim() || isSaving}>
                {isSaving ? <Spinner /> : null}
                {editing ? 'Save changes' : 'Add charity'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------ Delete */}
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent
          title={`Delete ${deleting?.name ?? 'this charity'}?`}
          description="Subscribers who chose this charity will have it cleared. Contribution history is kept."
        >
          {remove.isError ? (
            <Alert tone="danger" title="Could not delete">
              {describeDbError(remove.error)}
            </Alert>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={remove.isPending}>
              {remove.isPending ? <Spinner /> : null}
              Delete charity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
