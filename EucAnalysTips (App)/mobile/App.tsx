import type { Bankroll, Bet } from '@nouveau/types';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiClient, setAccessToken } from './src/api';

export default function App() {
  const [email, setEmail] = useState('demo@eucanalyptips.local');
  const [password, setPassword] = useState('Demo123!');
  const [token, setToken] = useState<string | null>(null);

  const [bankrollName, setBankrollName] = useState('Main bankroll');
  const [bankrollSport, setBankrollSport] = useState<'FOOTBALL' | 'BASKETBALL' | 'TENNIS'>('FOOTBALL');
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);

  const [stakeUnits, setStakeUnits] = useState('1');
  const [oddsDecimal, setOddsDecimal] = useState('1.90');
  const [eventStartAt, setEventStartAt] = useState(() => new Date(Date.now() + 3600_000).toISOString());
  const [isLive, setIsLive] = useState(false);

  const [bets, setBets] = useState<Bet[]>([]);

  const authenticated = useMemo(() => Boolean(token), [token]);

  async function login() {
    try {
      const response = await apiClient.login({ email, password });
      if (!response.accessToken) {
        throw new Error('Access token is missing in login response.');
      }
      setToken(response.accessToken);
      setAccessToken(response.accessToken);
      Alert.alert('Connected', 'Token received.');
    } catch (error) {
      Alert.alert('Login error', String(error));
    }
  }

  async function createBankroll() {
    try {
      const created = await apiClient.createBankroll({
        name: bankrollName,
        mode: 'FLEX_EDIT',
        sport: bankrollSport,
      });
      setBankroll(created);
      Alert.alert('Bankroll created', created.id);
    } catch (error) {
      Alert.alert('Create bankroll error', String(error));
    }
  }

  async function createBet() {
    if (!bankroll) {
      Alert.alert('No bankroll', 'Create bankroll first');
      return;
    }

    try {
      const bet = await apiClient.createBet({
        bankrollId: bankroll.id,
        sport: bankroll.sport,
        stakeUnits: Number(stakeUnits),
        oddsDecimal: Number(oddsDecimal),
        isLive,
        eventStartAt,
      });
      setBets((prev) => [bet, ...prev]);
      Alert.alert('Bet saved', bet.id);
    } catch (error) {
      Alert.alert('Create bet error', String(error));
    }
  }

  async function loadBets() {
    if (!bankroll) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'}/v1/bets?bankrollId=${bankroll.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const payload = (await response.json()) as Bet[];
      setBets(payload);
    } catch (error) {
      Alert.alert('Load bets error', String(error));
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Nouveau Tracking App</Text>
        <Text style={styles.sub}>MVP mobile for bankroll and bet tracking.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Login</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
          <Pressable style={styles.button} onPress={login}>
            <Text style={styles.buttonLabel}>Login</Text>
          </Pressable>
          <Text style={styles.note}>{authenticated ? 'Authenticated' : 'Disconnected'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Bankroll</Text>
          <TextInput style={styles.input} value={bankrollName} onChangeText={setBankrollName} />
          <View style={styles.row}>
            {(['FOOTBALL', 'BASKETBALL', 'TENNIS'] as const).map((sport) => (
              <Pressable
                key={sport}
                style={[styles.chip, bankrollSport === sport && styles.chipActive]}
                onPress={() => setBankrollSport(sport)}
              >
                <Text style={[styles.chipLabel, bankrollSport === sport && styles.chipLabelActive]}>{sport}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.button} onPress={createBankroll}>
            <Text style={styles.buttonLabel}>Create Bankroll</Text>
          </Pressable>
          <Text style={styles.note}>{bankroll ? bankroll.id : 'No bankroll yet'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Add Bet</Text>
          <TextInput style={styles.input} value={stakeUnits} onChangeText={setStakeUnits} keyboardType="decimal-pad" />
          <TextInput style={styles.input} value={oddsDecimal} onChangeText={setOddsDecimal} keyboardType="decimal-pad" />
          <TextInput style={styles.input} value={eventStartAt} onChangeText={setEventStartAt} autoCapitalize="none" />
          <Pressable style={[styles.button, isLive && styles.buttonAlt]} onPress={() => setIsLive((value) => !value)}>
            <Text style={styles.buttonLabel}>isLive: {isLive ? 'true' : 'false'}</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={createBet}>
            <Text style={styles.buttonLabel}>Create Bet</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={loadBets}>
            <Text style={styles.secondaryLabel}>Reload Bets</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>4. Bets</Text>
          {bets.map((bet) => (
            <View key={bet.id} style={styles.betRow}>
              <Text style={styles.betMain}>
                {bet.sport} • {bet.stakeUnits}u @ {bet.oddsDecimal}
              </Text>
              <Text style={styles.betSub}>
                {bet.status} • {bet.isLive ? 'LIVE' : 'PRE'} • {new Date(bet.createdAt).toLocaleString()}
              </Text>
            </View>
          ))}
          {bets.length === 0 ? <Text style={styles.note}>No bets loaded.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f2f8ef',
  },
  container: {
    padding: 16,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#142719',
  },
  sub: {
    color: '#48634f',
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#d7e8d6',
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'white',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#19311f',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cde1ce',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#f8fcf6',
  },
  button: {
    backgroundColor: '#2f8c5d',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonAlt: {
    backgroundColor: '#2a6aa1',
  },
  buttonLabel: {
    color: 'white',
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#2f8c5d',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryLabel: {
    color: '#2f8c5d',
    fontWeight: '700',
  },
  note: {
    color: '#48634f',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cde1ce',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fcf6',
  },
  chipActive: {
    borderColor: '#2f8c5d',
    backgroundColor: '#dff4e8',
  },
  chipLabel: {
    color: '#274533',
    fontWeight: '600',
    fontSize: 12,
  },
  chipLabelActive: {
    color: '#1b6c41',
  },
  betRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#e7f0e6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  betMain: {
    fontWeight: '700',
    color: '#15291a',
  },
  betSub: {
    color: '#4f6858',
    fontSize: 12,
  },
});
