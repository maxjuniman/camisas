import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { UseFormRegisterReturn, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { z } from 'zod';
import { Button, Field, Input, Notice, Select, TextArea } from '../../components/ui';
import { api } from '../../services/api';
import { Product, RefItem } from '../../types';

const schema = z.object({
  name: z.string().min(2, 'Informe o nome'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Informe o preço'),
  teamId: z.string().optional(),
  sportId: z.string().optional(),
  countryId: z.string().optional(),
  genderId: z.string().optional(),
  categoryId: z.string().optional(),
  seasonId: z.string().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'IGNORED']),
  isActive: z.boolean(),
  availableForOrder: z.boolean(),
  isFeatured: z.boolean(),
  isLaunch: z.boolean(),
  availabilityNote: z.string().optional(),
  orderNote: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;
type Lists = Record<'teams' | 'sports' | 'countries' | 'genders' | 'categories' | 'seasons' | 'sizes', RefItem[]>;

const emptyLists: Lists = { teams: [], sports: [], countries: [], genders: [], categories: [], seasons: [], sizes: [] };

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lists, setLists] = useState<Lists>(emptyLists);
  const [sizeIds, setSizeIds] = useState<string[]>([]);
  const [files, setFiles] = useState<FileList | null>(null);
  const [images, setImages] = useState<Product['images']>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      teamId: '',
      sportId: '',
      countryId: '',
      status: 'APPROVED',
      isActive: true,
      availableForOrder: true,
      isFeatured: false,
      isLaunch: false,
      availabilityNote: '',
      orderNote: '',
    },
  });

  useEffect(() => {
    Promise.all([
      api.get<RefItem[]>('/admin/taxonomies/teams'),
      api.get<RefItem[]>('/admin/taxonomies/sports'),
      api.get<RefItem[]>('/admin/taxonomies/countries'),
      api.get<RefItem[]>('/admin/taxonomies/genders'),
      api.get<RefItem[]>('/admin/taxonomies/categories'),
      api.get<RefItem[]>('/admin/taxonomies/seasons'),
      api.get<RefItem[]>('/admin/taxonomies/sizes'),
    ]).then(([teams, sports, countries, genders, categories, seasons, sizes]) => {
      setLists({
        teams: teams.data,
        sports: sports.data,
        countries: countries.data,
        genders: genders.data,
        categories: categories.data,
        seasons: seasons.data,
        sizes: sizes.data,
      });
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!id) return;
    api.get<Product>(`/admin/products/${id}`).then((response) => {
      const product = response.data;
      form.reset({
        name: product.name,
        description: product.description,
        price: product.price,
        teamId: product.team?.id || '',
        sportId: product.sport?.id || '',
        countryId: product.country?.id || '',
        genderId: product.gender?.id || '',
        categoryId: product.category?.id || '',
        seasonId: product.season?.id || '',
        status: product.status,
        isActive: product.isActive,
        availableForOrder: product.availableForOrder,
        isFeatured: product.isFeatured,
        isLaunch: product.isLaunch,
        availabilityNote: product.availabilityNote,
        orderNote: product.orderNote,
      });
      setSizeIds(product.sizes.map((size) => size.id));
      setImages(product.images);
    }).catch((reason: Error) => setError(reason.message));
  }, [id]);

  async function submit(values: FormValues) {
    setError('');
    const payload = { ...values, sizeIds };
    try {
      const saved = id
        ? (await api.patch<Product>(`/admin/products/${id}`, payload)).data
        : (await api.post<Product>('/admin/products', payload)).data;
      if (files?.length) {
        const body = new FormData();
        Array.from(files).forEach((file) => body.append('files', file));
        const uploaded = await api.post<Product>(`/admin/products/${saved.id}/images`, body);
        setImages(uploaded.data.images);
        setFiles(null);
      }
      setMessage('Produto salvo.');
      if (!id) navigate(`/admin/produtos/${saved.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao salvar.');
    }
  }

  async function removeImage(imageId: string) {
    if (!id || !window.confirm('Excluir esta imagem?')) return;
    const { data } = await api.delete<Product>(`/admin/products/${id}/images/${imageId}`);
    setImages(data.images);
  }

  async function makePrimary(imageId: string) {
    if (!id) return;
    const { data } = await api.patch<Product>(`/admin/products/${id}/images/${imageId}/primary`);
    setImages(data.images);
  }

  return (
    <section>
      <h1>{id ? 'Editar produto' : 'Novo produto'}</h1>
      <Form onSubmit={form.handleSubmit(submit)}>
        <Field>Nome para o site<Input {...form.register('name')} /></Field>
        <Field>Descrição<TextArea {...form.register('description')} /></Field>
        <Field>Preço<Input type="number" step="0.01" {...form.register('price')} /></Field>
        <Choice name="Esporte" options={lists.sports} register={form.register('sportId')} />
        <Choice name="País" options={lists.countries} register={form.register('countryId')} />
        <Choice name="Time" options={lists.teams} register={form.register('teamId')} onPick={(value) => {
          const team = lists.teams.find((item) => item.id === value);
          if (team?.sportId) form.setValue('sportId', team.sportId);
          if (team?.countryId) form.setValue('countryId', team.countryId);
        }} />
        <Choice name="Sexo" options={lists.genders} register={form.register('genderId')} />
        <Choice name="Categoria" options={lists.categories} register={form.register('categoryId')} />
        <Choice name="Temporada" options={lists.seasons} register={form.register('seasonId')} />
        <Field>
          Status
          <Select {...form.register('status')}>
            <option value="APPROVED">Aprovado</option>
            <option value="PENDING">Pendente</option>
            <option value="DRAFT">Rascunho</option>
            <option value="IGNORED">Ignorado</option>
          </Select>
        </Field>
        <Checks>
          <label><input type="checkbox" {...form.register('isActive')} /> Ativo</label>
          <label><input type="checkbox" {...form.register('availableForOrder')} /> Disponível para encomenda</label>
          <label><input type="checkbox" {...form.register('isFeatured')} /> Destaque</label>
          <label><input type="checkbox" {...form.register('isLaunch')} /> Lançamento</label>
        </Checks>
        <fieldset>
          <legend>Tamanhos</legend>
          {lists.sizes.map((size) => (
            <label key={size.id}>
              <input
                type="checkbox"
                checked={sizeIds.includes(size.id)}
                onChange={() => setSizeIds((current) => current.includes(size.id) ? current.filter((item) => item !== size.id) : [...current, size.id])}
              />
              {size.name}
            </label>
          ))}
        </fieldset>
        <Field>Disponibilidade<TextArea {...form.register('availabilityNote')} /></Field>
        <Field>Observações da encomenda<TextArea {...form.register('orderNote')} /></Field>
        <Field>Imagens<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(event.target.files)} /></Field>
        {form.formState.errors.name ? <Notice $kind="error">{form.formState.errors.name.message}</Notice> : null}
        {message ? <Notice $kind="ok">{message}</Notice> : null}
        {error ? <Notice $kind="error">{error}</Notice> : null}
        <Button type="submit">Salvar</Button>
      </Form>
      <Photos>
        {images.map((image) => (
          <figure key={image.id}>
            <img src={image.thumbUrl || image.url} alt={image.alt} />
            <button type="button" onClick={() => void makePrimary(image.id)}>{image.isPrimary ? 'Capa' : 'Tornar capa'}</button>
            <button type="button" onClick={() => void removeImage(image.id)}>Excluir</button>
          </figure>
        ))}
      </Photos>
    </section>
  );
}

function Choice({ name, options, register, onPick }: { name: string; options: RefItem[]; register: UseFormRegisterReturn; onPick?: (value: string) => void }) {
  return (
    <Field>
      {name}
      <Select {...register} onChange={(event) => { void register.onChange(event); onPick?.(event.target.value); }}>
        <option value="">Selecione</option>
        {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </Select>
    </Field>
  );
}

const Form = styled.form`display: grid; gap: 12px; max-width: 760px; fieldset { border: 1px solid ${({ theme }) => theme.line}; display: flex; flex-wrap: wrap; gap: 10px; }`;
const Checks = styled.div`display: flex; flex-wrap: wrap; gap: 14px;`;
const Photos = styled.div`
  display: flex; gap: 12px; flex-wrap: wrap;
  figure { width: 120px; }
  img { width: 120px; height: 150px; object-fit: cover; }
  button { display: block; background: none; border: 0; padding: 0; text-decoration: underline; cursor: pointer; }
`;
