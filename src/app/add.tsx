import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { AppText, Button, PillToggle, PrimaryButton, Input } from '@/components/ui';
import {
  AmountDisplay,
  AmountKeypad,
  CategoryPickerSheet,
  DatePickerSheet,
  Sheet,
} from '@/components/dashboard';
import { useTheme } from '@/theme';
import { ScreenContainer } from '@/components/Screen';
import { useDatabase, getDatabase } from '@/database/DatabaseProvider';
import { categoriesRepo } from '@/database/repositories/categories';
import { fixedRepo, variableRepo } from '@/database/repositories/expenses';
import { sourcesRepo, incomesRepo } from '@/database/repositories/incomes';
import { installmentsRepo } from '@/database/repositories/installments';
import { checkSpendingLimitNotifications } from '@/services/spendingLimits';
import { useMoneyInput } from '@/hooks/useMoneyInput';
import { formatCurrency } from '@/utils/currency';
import { formatDateShort } from '@/utils/date';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type Category, type PaymentMethod } from '@/database/types';

type EntryKind = 'expense' | 'income';

const METHOD_ICONS: Record<PaymentMethod, string> = {
  pix: 'zap',
  debito: 'creditCard',
  credito: 'creditCard',
  dinheiro: 'banknote',
};

export default function AddScreen() {
  const { colors, typography, spacing, gutter } = useTheme();
  const insets = useSafeAreaInsets();
  const { invalidate } = useDatabase();
  const params = useLocalSearchParams<{ kind?: string; mode?: string }>();

  const [kind, setKind] = useState<EntryKind>(params.kind === 'income' ? 'income' : 'expense');
  // `fixed` cria o template de conta fixa, que é outra tabela: entra pela tela
  // de contas fixas e não é offered na segmentação principal.
  const [installmentsMode, setInstallmentsMode] = useState(false);
  const [fixedMode, setFixedMode] = useState(params.mode === 'fixed');
  const [dueDay, setDueDay] = useState(10);
  // Semeado uma vez: a data padrão de um lançamento novo é o instante em que
  // a tela abriu, não o momento de cada re-render.
  const [date, setDate] = useState(() => Date.now());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [description, setDescription] = useState('');
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [isPaid, setIsPaid] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [installmentPickerOpen, setInstallmentPickerOpen] = useState(false);
  const [methodPickerOpen, setMethodPickerOpen] = useState(false);
  const [dueDayPickerOpen, setDueDayPickerOpen] = useState(false);

  const amount = useMoneyInput();
  const scrollViewRef = useRef<ScrollView>(null);
  const captureInProgress = useRef(false);
const isExpense = kind === 'expense';
const isIncome = kind === 'income';
const isInstallment = isExpense && installmentsMode && !fixedMode;
const isFixed = isExpense && fixedMode;

React.useEffect(() => {
  if (!descriptionFocused) return;
  const subscription = Keyboard.addListener('keyboardDidShow', () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  });
  return () => subscription.remove();
}, [descriptionFocused]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<{ id: number; name: string; color: string; icon: string }[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = await getDatabase();

      // Gancho não tem categoria no schema (usa `source_id`), então só os
      // gastos precisam delas. Template de conta fixa usa `fixed`; gasto e
      // parcela usam `variable`.
      if (!isExpense) {
        const srcs = await sourcesRepo.list(db);
        if (cancelled) return;
        setCategories([]);
        setSources(srcs);
        setSourceId((current) => current ?? srcs[0]?.id ?? null);
        return;
      }

      const cats = await categoriesRepo.list(db, fixedMode ? 'fixed' : 'variable');
      if (cancelled) return;
      setCategories(cats);
      setSources([]);
      setCategoryId((current) =>
        current === null || !cats.some((c) => c.id === current)
          ? (cats[0]?.id ?? null)
          : current
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [isExpense, fixedMode]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId]
  );

  const selectedSource = useMemo(
    () => sources.find((s) => s.id === sourceId) ?? null,
    [sources, sourceId]
  );

  const accent = isIncome ? colors.income : colors.expense;

  const reset = useCallback(() => {
    amount.clear();
    setDescription('');
    setInstallmentsMode(false);
    setInstallmentCount(1);
    setDate(Date.now());
    setIsPaid(true);
  }, [amount]);

  const canSave = amount.cents > 0 && (isExpense ? categoryId !== null : sourceId !== null);

  const captureReceipt = useCallback(async () => {
    if (!isExpense || captureInProgress.current) return;
    captureInProgress.current = true;
    setCaptureLoading(true);
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Câmera indisponível', 'O registro automático pela nota está disponível no app para Android e iOS.');
        return;
      }

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permissão necessária', 'Para registrar pela nota, permita o acesso à câmera.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
        mediaTypes: ['images'],
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const { keepReceiptImage, scanReceipt, selectReceiptCategory } = await import('@/services/receiptScanner');
      const receipt = await scanReceipt(asset.uri);
      if (!receipt) {
        Alert.alert(
          'Não foi possível ler a nota',
          'Tente fotografar novamente, enquadrando o nome do estabelecimento e o valor indicado como total ou a pagar.'
        );
        return;
      }

      const db = await getDatabase();
      const availableCategories = await categoriesRepo.list(db, 'variable');
      let category = selectReceiptCategory(receipt.text, availableCategories);
      if (!category) {
        const otherCategoryId = await categoriesRepo.create(db, {
          name: 'Outros',
          color: colors.textSecondary,
          icon: 'receipt',
          kind: 'variable',
        });
        category = await categoriesRepo.byId(db, otherCategoryId);
      }
      if (!category) {
        throw new Error('Não foi possível definir uma categoria para este gasto.');
      }

      const savedReceiptUri = keepReceiptImage(asset.uri, asset.fileName);
      await variableRepo.create(db, {
        category_id: category.id,
        amount_cents: receipt.amountCents,
        date: receipt.date,
        method: receipt.method,
        description: receipt.merchant,
        is_paid: receipt.method !== 'credito',
        receipt_uri: savedReceiptUri,
        receipt_ocr_text: receipt.text,
      });
      reset();
      invalidate();
      void checkSpendingLimitNotifications(db).catch((error: unknown) => {
        console.error('Não foi possível verificar os alertas de limite após salvar o gasto da nota.', error);
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((error: unknown) => {
        console.warn('Não foi possível reproduzir a confirmação tátil do gasto da nota.', error);
      });
      Alert.alert(
        'Gasto registrado',
        `${receipt.merchant} · ${formatCurrency(receipt.amountCents)} · ${category.name}`
      );
    } catch (error) {
      Alert.alert(
        'Não foi possível registrar pela nota',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      captureInProgress.current = false;
      setCaptureLoading(false);
    }
  }, [colors.textSecondary, invalidate, isExpense, reset]);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    // Definido aqui para o `reset` navegar depois de limpar o formulário.
    let redirectTo = '/';

    try {
      const db = await getDatabase();
      const note = description.trim() || null;

      if (isInstallment) {
        // Parcela é dívida de cartão por definição: a forma de pagamento real do
// débito já está no cartão, não no lançamento.
await installmentsRepo.createGroup(db, {
          count: installmentCount,
          amount_cents: Math.round(amount.cents / installmentCount),
          first_due_date: date,
          category_id: categoryId!,
          method: 'credito',
          description: note,
          income_source_id: null,
        });
      } else if (isFixed) {
        // Template: guarda dia de vencimento, não uma data específica.
        await fixedRepo.create(db, {
          category_id: categoryId!,
          amount_cents: amount.cents,
          due_day: dueDay,
          method,
          description: note,
        });
        redirectTo = '/gastos/fixos';
      } else if (isExpense) {
        await variableRepo.create(db, {
          category_id: categoryId!,
          amount_cents: amount.cents,
          date,
          method,
          description: note,
          is_paid: isPaid,
        });
      } else {
        await incomesRepo.create(db, {
          source_id: sourceId!,
          amount_cents: amount.cents,
          date,
          description: note,
          method,
        });
      }

      if (isExpense) {
        void checkSpendingLimitNotifications(db).catch((error: unknown) => {
          console.error('Não foi possível verificar os alertas de limite após salvar o gasto.', error);
        });
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      reset();
      router.replace(redirectTo as never);
      router.back();
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Não foi possível salvar', error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const confirmDiscard = () => {
    if (amount.isEmpty && !description.trim()) {
      router.back();
      return;
    }
    Alert.alert('Descartar lançamento?', 'O que você preencheu será perdido.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
    <ScreenContainer
      safeTop={false}
      safeBottom={false}
      horizontalGutter={false}
      style={[styles.flex, { backgroundColor: colors.background }]}
    >
      <Animated.View
        entering={FadeInUp.duration(180)}
        style={[styles.header, { paddingTop: insets.top + spacing.xl + spacing.sm, paddingHorizontal: gutter }]}
      >
        <IconButtonClose onPress={confirmDiscard} />
        <AppText style={[typography.h3, { color: colors.text }]}>Novo lançamento</AppText>
        <View style={styles.spacer} />
      </Animated.View>

      <ScrollView
        ref={scrollViewRef}
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          backgroundColor: colors.background,
          paddingHorizontal: gutter,
          paddingBottom: spacing.xl,
          gap: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onContentSizeChange={() => {
          if (descriptionFocused) scrollViewRef.current?.scrollToEnd({ animated: true });
        }}
        showsVerticalScrollIndicator={false}
      >
        <PillToggle
          options={[
            { value: 'expense', label: 'Gasto' },
            { value: 'income', label: 'Ganho' },
          ]}
          value={kind}
          onChange={(next) => {
            setKind(next as EntryKind);
            setInstallmentsMode(false);
            setCategoryId(null);
            setSourceId(null);
          }}
        />

        <AmountDisplay
          amount={amount}
          label={isExpense ? 'Quanto você gastou?' : 'Quanto você ganhou?'}
          accent={accent}
        />
        <AppText style={[typography.caption, { color: colors.textTertiary, textAlign: 'center', marginTop: -spacing.md }]}>
          Digite os números; os dois últimos representam centavos.
        </AppText>

        <Animated.View entering={FadeInDown.duration(200)} style={{ gap: spacing.sm }}>
          {isExpense ? (
            <>
              <PickerRow
                label="Categoria"
                value={selectedCategory?.name ?? 'Escolher'}
                icon={selectedCategory?.icon ?? 'palette'}
                accent={selectedCategory?.color ?? colors.primaryLight}
                onPress={() => setCategoryPickerOpen(true)}
              />
              {/* Template recorrente não tem data única: só dia de vencimento. */}
              {isFixed ? (
                <PickerRow
                  label="Vence dia"
                  value={`Dia ${dueDay}`}
                  icon="calendar"
                  onPress={() => setDueDayPickerOpen(true)}
                />
              ) : (
                <PickerRow
                  label={isInstallment ? '1º vencimento' : 'Quando'}
                  value={formatDateShort(date)}
                  icon="calendar"
                  onPress={() => setDatePickerOpen(true)}
                />
              )}
              <PickerRow
                label="Forma de pagamento"
                value={PAYMENT_METHOD_LABELS[method]}
                icon={METHOD_ICONS[method]}
                onPress={() => setMethodPickerOpen(true)}
              />
              {method === 'credito' && !isInstallment && !isFixed ? (
                <AppText style={[typography.caption, { color: colors.textTertiary }]}>
                  A compra entra em Gastos na data da compra; ela só reduz o saldo quando você pagar a fatura.
                </AppText>
              ) : null}
            </>
          ) : (
            <>
              <PickerRow
                label="Fonte"
                value={selectedSource?.name ?? 'Escolher'}
                icon={selectedSource?.icon ?? 'wallet'}
                accent={selectedSource?.color ?? colors.income}
                onPress={() => setSourcePickerOpen(true)}
              />
              <PickerRow
                label="Quando"
                value={formatDateShort(date)}
                icon="calendar"
                onPress={() => setDatePickerOpen(true)}
              />
            </>
          )}
        </Animated.View>

        {isExpense && !isFixed && !isInstallment ? (
          <Animated.View entering={FadeInDown.delay(50).duration(200)} style={{ gap: spacing.sm }}>
            <AppText style={[typography.label, { color: colors.textTertiary }]}>Nota fiscal</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fotografar nota e registrar gasto automaticamente"
              disabled={captureLoading}
              onPress={() => void captureReceipt()}
              style={({ pressed }) => [{
                borderRadius: 18,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                opacity: captureLoading ? 0.6 : pressed ? 0.8 : 1,
              }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                  <View style={[styles.pickerIcon, { backgroundColor: `${colors.primaryLight}22` }]}>
                    <Icon name="camera" size={18} color={colors.primaryLight} strokeWidth={2.1} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={[typography.bodyStrong, { color: colors.text }]}>
                      {captureLoading ? 'Lendo nota fiscal…' : 'Fotografar e registrar gasto'}
                    </AppText>
                    <AppText style={[typography.caption, { color: colors.textTertiary }]}>
                      {captureLoading
                        ? 'Identificando estabelecimento e valor total'
                        : 'O app identifica o estabelecimento e o valor e salva o gasto'}
                    </AppText>
                  </View>
                </View>
                {captureLoading ? <AppText style={[typography.caption, { color: colors.primaryLight }]}>…</AppText> : null}
              </View>
            </Pressable>
          </Animated.View>
        ) : null}

        {isExpense ? (
          <Animated.View entering={FadeInDown.delay(80).duration(200)} style={{ gap: spacing.sm }}>
            <AppText style={[typography.label, { color: colors.textTertiary }]}>Tipo</AppText>
            <View style={styles.chipRow}>
              <ToggleChip
                label="À vista"
                active={!installmentsMode && !fixedMode}
                onPress={() => {
                  setInstallmentsMode(false);
                  setFixedMode(false);
                }}
              />
              <ToggleChip
                label="Parcelado"
                active={installmentsMode && !fixedMode}
                onPress={() => {
                  setFixedMode(false);
                  setInstallmentsMode(true);
                  // Uma parcela única não é parcelamento; entra no modo já com o
                  // menor número válido para o grupo não nascer com 1 de N.
                  setInstallmentCount((count) => (count < 2 ? 2 : count));
                }}
              />
              <ToggleChip
                label="Conta fixa"
                active={fixedMode}
                onPress={() => {
                  setInstallmentsMode(false);
                  setFixedMode(true);
                }}
              />
            </View>

            {isInstallment ? (
              <Animated.View entering={FadeInDown.duration(180)}>
                <PickerRow
                  label="Parcelas"
                  value={`${installmentCount}x de ${formatCurrency(Math.round(amount.cents / installmentCount))}`}
                  icon="creditCard"
                  onPress={() => setInstallmentPickerOpen(true)}
                />
              </Animated.View>
            ) : null}

            {!isInstallment && !isFixed ? (
              <View style={{ gap: spacing.sm }}>
                <AppText style={[typography.label, { color: colors.textTertiary }]}>
                  {method === 'credito' ? 'Fatura do cartão paga?' : 'Esse gasto já foi pago?'}
                </AppText>
                <View style={styles.chipRow}>
                  <ToggleChip label="Já paguei" active={isPaid} onPress={() => setIsPaid(true)} />
                  <ToggleChip label="Pendente" active={!isPaid} onPress={() => setIsPaid(false)} />
                </View>
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(120).duration(200)}>
          <Input
            placeholder="Observação (opcional)"
            icon="fileText"
            value={description}
            onChangeText={setDescription}
            onClear={() => setDescription('')}
            onFocus={() => setDescriptionFocused(true)}
            onBlur={() => setDescriptionFocused(false)}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            maxLength={80}
          />
        </Animated.View>

        <PrimaryButton
          label={isExpense ? 'Salvar gasto' : 'Salvar ganho'}
          icon="check"
          loading={saving}
          disabled={!canSave}
          onPress={() => {
            void save();
          }}
        />
      </ScrollView>

      {!descriptionFocused ? (
        <View
          style={{
            paddingHorizontal: gutter,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom,
            backgroundColor: colors.background,
          }}
        >
          <AmountKeypad
            onPress={(key) => (key === 'del' ? amount.backspace() : amount.append(key))}
          />
        </View>
      ) : null}

      <CategoryPickerSheet
        visible={categoryPickerOpen}
        categories={categories.filter((c) => (isInstallment ? c.kind === 'variable' : true))}
        value={categoryId}
        onClose={() => setCategoryPickerOpen(false)}
        onSelect={(category) => {
          setCategoryId(category.id);
          setCategoryPickerOpen(false);
        }}
      />

      <SourcePickerSheet
        visible={sourcePickerOpen}
        sources={sources}
        value={sourceId}
        onClose={() => setSourcePickerOpen(false)}
        onSelect={(source) => {
          setSourceId(source.id);
          setSourcePickerOpen(false);
        }}
      />

      <DatePickerSheet
        visible={datePickerOpen}
        value={date}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(timestamp) => {
          setDate(timestamp);
          setDatePickerOpen(false);
        }}
      />

      <InstallmentCountSheet
        visible={installmentPickerOpen}
        value={installmentCount}
        totalCents={amount.cents}
        onClose={() => setInstallmentPickerOpen(false)}
        onSelect={(count) => {
          setInstallmentCount(count);
          setInstallmentPickerOpen(false);
        }}
      />

      <MethodPickerSheet
        visible={methodPickerOpen}
        value={method}
        onClose={() => setMethodPickerOpen(false)}
        onSelect={(option) => {
          setMethod(option);
          setIsPaid(option !== 'credito');
          setMethodPickerOpen(false);
        }}
      />

      <DueDaySheet
        visible={dueDayPickerOpen}
        value={dueDay}
        onClose={() => setDueDayPickerOpen(false)}
        onSelect={(day) => {
          setDueDay(day);
          setDueDayPickerOpen(false);
        }}
      />
    </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function IconButtonClose({ onPress }: { onPress: () => void }) {
  const { colors, radii } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fechar"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.close,
        { backgroundColor: colors.surface, borderRadius: radii.pill, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name="close" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function PickerRow({
  label,
  value,
  icon,
  accent,
  onPress,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: string;
  onPress: () => void;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  const tint = accent ?? colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickerRow,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing.lg,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.pickerIcon, { backgroundColor: `${tint}1F` }]}>
        <Icon name={icon} size={18} color={tint} strokeWidth={2.1} />
      </View>
      <AppText style={[typography.caption, { color: colors.textTertiary }]}>{label}</AppText>
      <View style={styles.flex} />
      <AppText numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
        {value}
      </AppText>
      <Icon name="chevronRight" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function ToggleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors, typography, radii, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleChip,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: active ? colors.primaryDim : colors.surface,
          borderColor: active ? colors.primaryBorder : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <AppText style={[typography.label, { color: active ? colors.text : colors.textTertiary }]}>{label}</AppText>
    </Pressable>
  );
}

function SourcePickerSheet({
  visible,
  sources,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  sources: { id: number; name: string; color: string; icon: string }[];
  value: number | null;
  onClose: () => void;
  onSelect: (source: { id: number }) => void;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Fonte do ganho">
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        {sources.map((source) => (
          <Pressable
            key={source.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: source.id === value }}
            accessibilityLabel={source.name}
            onPress={() => onSelect(source)}
            style={({ pressed }) => [
              styles.pickerRow,
              {
                borderRadius: radii.lg,
                backgroundColor: colors.surface,
                borderColor: source.id === value ? colors.primaryBorder : colors.border,
                padding: spacing.lg,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={[styles.pickerIcon, { backgroundColor: `${source.color}1F` }]}>
              <Icon name={source.icon} size={18} color={source.color} strokeWidth={2.1} />
            </View>
            <AppText style={[typography.bodyStrong, { color: colors.text }]}>{source.name}</AppText>
            <View style={styles.flex} />
            {source.id === value ? <Icon name="check" size={18} color={colors.primaryLight} /> : null}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

function DueDaySheet({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: number;
  onClose: () => void;
  onSelect: (day: number) => void;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  // Grade de 7 colunas para os dias caberem na tela sem scroll.
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

  return (
    <Sheet visible={visible} onClose={onClose} title="Dia de vencimento">
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        <View style={styles.dueDayGrid}>
          {days.map((day) => {
            const active = day === value;
            return (
              <Pressable
                key={day}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Dia ${day}`}
                onPress={() => onSelect(day)}
                style={({ pressed }) => [
                  styles.dueDayCell,
                  {
                    borderRadius: radii.lg,
                    backgroundColor: active ? colors.primaryDim : colors.surface,
                    borderColor: active ? colors.primaryBorder : colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <AppText
                  style={[
                    typography.bodyStrong,
                    { color: active ? colors.text : colors.textTertiary },
                  ]}
                >
                  {day}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <Button label="Confirmar" variant="primary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

function MethodPickerSheet({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: PaymentMethod;
  onClose: () => void;
  onSelect: (method: PaymentMethod) => void;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Forma de pagamento">
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        {PAYMENT_METHODS.map((option) => {
          const active = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={PAYMENT_METHOD_LABELS[option]}
              onPress={() => onSelect(option)}
              style={({ pressed }) => [
                styles.pickerRow,
                {
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface,
                  borderColor: active ? colors.primaryBorder : colors.border,
                  padding: spacing.lg,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.pickerIcon,
                  { backgroundColor: active ? colors.primaryDim : colors.fillStrong },
                ]}
              >
                <Icon
                  name={METHOD_ICONS[option]}
                  size={18}
                  color={active ? colors.primaryLight : colors.textSecondary}
                  strokeWidth={2.1}
                />
              </View>
              <AppText style={[typography.bodyStrong, { color: colors.text }]}>
                {PAYMENT_METHOD_LABELS[option]}
              </AppText>
              <View style={styles.flex} />
              {active ? <Icon name="check" size={18} color={colors.primaryLight} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

function InstallmentCountSheet({
  visible,
  value,
  totalCents,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: number;
  totalCents: number;
  onClose: () => void;
  onSelect: (count: number) => void;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  const options = Array.from({ length: 48 }, (_, i) => i + 1);

  return (
    <Sheet visible={visible} onClose={onClose} title="Número de parcelas">
      <View
        style={[
          styles.installmentList,
          {
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.lg,
            gap: spacing.sm,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: option === value }}
            accessibilityLabel={`${option}x de ${formatCurrency(Math.round(totalCents / option))}`}
            onPress={() => onSelect(option)}
            style={({ pressed }) => [
              styles.installmentOption,
              {
                borderRadius: radii.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                backgroundColor: option === value ? colors.primaryDim : colors.surface,
                borderColor: option === value ? colors.primaryBorder : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <AppText style={[typography.bodyStrong, { color: option === value ? colors.text : colors.textSecondary }]}>
              {`${option}x de ${formatCurrency(Math.round(totalCents / option))}`}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  close: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 38,
  },
  dueDayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  dueDayCell: {
    width: '11%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  installmentList: {
    width: '100%',
  },
  installmentOption: {
    width: '100%',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleChip: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});